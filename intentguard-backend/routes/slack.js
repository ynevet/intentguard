const crypto = require('crypto');
const express = require('express');
const logger = require('../lib/logger');
const { getSlackClient, getSlackUserClient, invalidateClientCache } = require('../lib/slack-client');
const { analyzeMessage } = require('../lib/risk-engine');
const { saveEvaluation, recordEvent } = require('../lib/evaluation-store');
const { getSetting, getWorkspace, deactivateWorkspace } = require('../lib/db');
const { joinChannel } = require('../lib/channel-join');

const router = express.Router();

// Short-lived dedup cache: prevents double-analysis when Slack fires both a
// `message` event and a `file_shared` event for the same upload.
// Key: `${channel}:${ts}`, TTL: 30 seconds.
const _processedMsgTs = new Map();
function markProcessed(channel, ts) {
  const key = `${channel}:${ts}`;
  _processedMsgTs.set(key, Date.now());
  // Evict entries older than 30s on each write (low-frequency, no setInterval needed)
  const cutoff = Date.now() - 30_000;
  for (const [k, t] of _processedMsgTs) {
    if (t < cutoff) _processedMsgTs.delete(k);
  }
}
function wasProcessed(channel, ts) {
  return _processedMsgTs.has(`${channel}:${ts}`);
}

function getRawBody(body) {
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  if (typeof body === 'string') return body;
  return '';
}

function verifySlackRequest(req, body) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return true;

  const requestSignature = req.headers['x-slack-signature'];
  const requestTimestamp = Number(req.headers['x-slack-request-timestamp']);

  if (!requestSignature || Number.isNaN(requestTimestamp)) {
    throw new Error('Missing Slack signature headers');
  }

  // Reject requests older than 5 minutes (replay attack protection)
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - (60 * 5);
  if (requestTimestamp < fiveMinutesAgo) {
    throw new Error('Slack request timestamp is too old');
  }

  const [version, hash] = requestSignature.split('=');
  if (version !== 'v0') {
    throw new Error('Unknown Slack signature version');
  }

  // Compute HMAC-SHA256: v0:{timestamp}:{body}
  const hmac = crypto.createHmac('sha256', signingSecret);
  hmac.update(`${version}:${requestTimestamp}:${body}`);
  const computedHash = hmac.digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (!hash || hash.length !== computedHash.length ||
      !crypto.timingSafeEqual(Buffer.from(hash, 'utf8'), Buffer.from(computedHash, 'utf8'))) {
    throw new Error('Slack request signature mismatch');
  }

  return true;
}

function verifyAndParseSlackPayload(req) {
  const rawBody = getRawBody(req.body);
  if (!rawBody) {
    throw new Error('Missing request body');
  }

  verifySlackRequest(req, rawBody);
  return JSON.parse(rawBody);
}

async function reactToAssessment(event, assessment, workspaceId = 'default', evaluationId = null) {
  const confidencePct = Math.round(assessment.confidence * 100);
  const fileDetails = assessment.filesAnalyzed
    .map((f) => `- *${f.name}* (${f.method}): ${f.finding}`)
    .join('\n');
  const contextRiskLabel = assessment.contextRisk && assessment.contextRisk !== 'none'
    ? `\n:globe_with_meridians: *Audience risk:* ${assessment.contextRisk}`
    : '';

  try {
    const client = await getSlackClient(workspaceId);
    const userClient = await getSlackUserClient(workspaceId);

    if (!client) {
      logger.warn({ workspaceId }, 'No Slack client available for assessment reaction');
      return;
    }

    if (assessment.match === 'mismatch') {
      // Separate native files (can be deleted) from link-only findings (cannot be deleted)
      const nativeFiles = (event.files || []).filter((f) => !f._isLink && f.id);
      const linkFiles = assessment.filesAnalyzed.filter((f) => f.method === 'link-metadata');
      const hasNativeFiles = nativeFiles.length > 0;
      const hasLinkOnly = linkFiles.length > 0 && !hasNativeFiles;

      // 1. Delete native mismatched files (not links — those are just message text)
      if (hasNativeFiles) {
        if (!userClient) {
          logger.warn('No user token configured — cannot delete user-uploaded files');
        } else {
          for (const file of nativeFiles) {
            try {
              await userClient.files.delete({ file: file.id });
              logger.info({ fileId: file.id, fileName: file.name, channel: event.channel, user: event.user }, 'Deleted mismatched file');
              if (evaluationId) {
                recordEvent(evaluationId, workspaceId, 'file_deleted', { fileId: file.id, fileName: file.name });
              }
            } catch (delErr) {
              logger.error({ err: delErr, fileId: file.id, fileName: file.name }, 'Failed to delete mismatched file');
            }
          }
        }
      }

      // 2. DM the sender — wording differs for link-only vs file mismatch
      try {
        const dm = await client.conversations.open({ users: event.user });
        let dmText;
        if (hasLinkOnly) {
          // Link flagged — nothing deleted, just a warning
          dmText = `:warning: *Intentify AI — Link flagged* (${confidencePct}% confidence)\n\nA link you shared in <#${event.channel}> may not match what you described, or may be inappropriate for that channel.\n\n*Reasoning:*\n${assessment.reasoning}${contextRiskLabel}\n\n*Flagged links:*\n${fileDetails}\n\n_The link was not removed. Please verify the content is appropriate before sharing._`;
        } else {
          // Native file deleted
          dmText = `:no_entry_sign: *Intentify AI — File removed* (${confidencePct}% confidence)\n\nA file you shared in <#${event.channel}> was removed because it may not match what you described.\n\n*Reasoning:*\n${assessment.reasoning}${contextRiskLabel}\n\n*Files removed:*\n${fileDetails}`;
        }
        await client.chat.postMessage({ channel: dm.channel.id, text: dmText });
        logger.info({ user: event.user, channel: event.channel, hasLinkOnly }, 'Sent mismatch DM to user');
        if (evaluationId) {
          recordEvent(evaluationId, workspaceId, 'dm_sent', { user: event.user, channel: event.channel });
        }
      } catch (dmErr) {
        logger.error({ err: dmErr, user: event.user }, 'Failed to send mismatch DM to user');
      }
    } else if (assessment.match === 'match') {
      await client.reactions.add({
        channel: event.channel,
        name: 'white_check_mark',
        timestamp: event.ts,
      });
    } else if (assessment.match === 'uncertain') {
      await client.reactions.add({
        channel: event.channel,
        name: 'grey_question',
        timestamp: event.ts,
      });
    }
    // 'skipped' — no reaction
  } catch (error) {
    logger.error({ err: error, channel: event.channel, ts: event.ts }, 'Failed to post assessment reaction');
  }
}

async function processEvent(payload) {
  const event = payload.event;

  // Resolve workspace from team_id: DB lookup first, fall back to 'default' if env vars set.
  // Retry once after 1s to handle the race where a brand-new workspace sends its first event
  // before the OAuth callback DB write has propagated (especially on Supabase).
  let workspaceId = 'default';
  const teamId = payload.team_id;
  if (teamId) {
    let workspace = await getWorkspace(teamId);
    if (!workspace) {
      // Single retry after short delay for brand-new workspaces
      await new Promise((r) => setTimeout(r, 1000));
      workspace = await getWorkspace(teamId);
    }
    if (workspace) {
      workspaceId = teamId;
    } else if (!process.env.SLACK_BOT_TOKEN) {
      logger.warn({ teamId }, 'Unknown workspace and no SLACK_BOT_TOKEN env var — ignoring event');
      return;
    }
  }

  if (event.type === 'message') {
    // Log message metadata only — no user content, no file URLs
    logger.info({
      user: event.user,
      channel: event.channel,
      ts: event.ts,
      thread_ts: event.thread_ts,
      subtype: event.subtype,
      client_msg_id: event.client_msg_id,
      hasText: !!event.text,
      textLength: event.text?.length || 0,
      files: event.files?.map((f) => ({
        id: f.id,
        name: f.name,
        mimetype: f.mimetype,
        filetype: f.filetype,
        size: f.size,
      })),
    }, 'Slack message');

    // Skip thread replies (e.g. our own bot responses getting re-processed)
    if (event.thread_ts && event.thread_ts !== event.ts) {
      logger.info({ thread_ts: event.thread_ts, ts: event.ts }, 'Skipping thread reply');
      return;
    }

    // Skip bot messages
    if (event.bot_id || event.bot_profile) {
      logger.info({ bot_id: event.bot_id }, 'Skipping bot message');
      return;
    }

    // Check if analysis is enabled (global setting)
    const analysisEnabled = await getSetting('analysis_enabled', workspaceId);
    if (analysisEnabled === 'false') {
      logger.info({ channel: event.channel, ts: event.ts }, 'Analysis disabled, skipping');
      return;
    }

    // Check if this channel is monitored (empty = all channels)
    const monitoredChannels = await getSetting('slack.monitored_channels', workspaceId) || '';
    if (monitoredChannels.trim()) {
      const channelList = monitoredChannels.split(',').map((c) => c.trim()).filter(Boolean);
      if (!channelList.includes(event.channel)) {
        logger.info({ channel: event.channel, monitored: channelList }, 'Channel not monitored, skipping');
        return;
      }
    }

    // Check if this channel is excluded from scanning
    const excludedChannels = (await getSetting('slack.excluded_channels', workspaceId) || '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    if (excludedChannels.includes(event.channel)) {
      logger.info({ channel: event.channel }, 'Channel excluded from scanning, skipping');
      return;
    }

    // Mark this (channel, ts) as processed so file_shared doesn't double-analyze
    markProcessed(event.channel, event.ts);

    // Run risk analysis on messages with text + files
    const assessment = await analyzeMessage(event, workspaceId);
    logger.info({
      match: assessment.match,
      confidence: assessment.confidence,
      mismatchType: assessment.mismatchType,
      intentLabel: assessment.intentLabel,
    }, 'Risk assessment result');

    // saveEvaluation hashes event.text synchronously before any await,
    // so the in-memory cleanup below is safe. We await it now to get the evaluationId for action tracking.
    const evaluationId = await saveEvaluation(event, assessment, 'slack', workspaceId);
    await reactToAssessment(event, assessment, workspaceId, evaluationId);

    // In-memory cleanup: scrub sensitive data after all processing is complete
    event.text = null;
    if (event.files) {
      for (const f of event.files) {
        f.url_private = null;
        f.url_private_download = null;
        f.permalink = null;
      }
    }
  } else if (event.type === 'file_shared') {
    // file_shared fires when a file is uploaded to a channel.
    // It does NOT carry message text or the full file object — we must fetch the
    // originating message from conversations.history using the message_ts / event_ts.
    const channelId = event.channel_id;
    const userId    = event.user_id;
    const fileId    = event.file_id;

    if (!channelId || !userId) {
      logger.info({ event_type: 'file_shared', fileId }, 'file_shared missing channel/user — skipping');
      return;
    }

    // Check if analysis is enabled
    const analysisEnabledFs = await getSetting('analysis_enabled', workspaceId);
    if (analysisEnabledFs === 'false') {
      logger.info({ channelId }, 'Analysis disabled, skipping file_shared');
      return;
    }

    // Check channel monitoring / exclusion rules
    const monitoredChannelsFs = await getSetting('slack.monitored_channels', workspaceId) || '';
    if (monitoredChannelsFs.trim()) {
      const channelList = monitoredChannelsFs.split(',').map((c) => c.trim()).filter(Boolean);
      if (!channelList.includes(channelId)) {
        logger.info({ channel: channelId }, 'Channel not monitored, skipping file_shared');
        return;
      }
    }
    const excludedChannelsFs = (await getSetting('slack.excluded_channels', workspaceId) || '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    if (excludedChannelsFs.includes(channelId)) {
      logger.info({ channel: channelId }, 'Channel excluded, skipping file_shared');
      return;
    }

    // Fetch the originating message so we have text + full file metadata
    const client = await getSlackClient(workspaceId);
    if (!client) {
      logger.warn({ channelId, workspaceId }, 'No Slack client for file_shared lookup');
      return;
    }

    let syntheticEvent = null;
    try {
      // Fetch the originating message via conversations.history (requires channels:history +
      // groups:history, now included in BOT_SCOPES). This is the only reliable way to get
      // the message text the user typed alongside the file in modern Slack.
      const histResult = await client.conversations.history({
        channel:   channelId,
        latest:    event.event_ts,
        limit:     5,
        inclusive: true,
      });

      const msg = (histResult.messages || []).find((m) =>
        m.files && m.files.some((f) => f.id === fileId),
      );

      if (!msg) {
        logger.warn({ channelId, fileId, event_ts: event.event_ts }, 'file_shared: originating message not found — skipping');
        return;
      }

      // Skip thread replies and bot messages
      if (msg.thread_ts && msg.thread_ts !== msg.ts) {
        logger.info({ thread_ts: msg.thread_ts, ts: msg.ts }, 'file_shared: skipping thread reply');
        return;
      }
      if (msg.bot_id || msg.bot_profile) {
        logger.info({ bot_id: msg.bot_id }, 'file_shared: skipping bot message');
        return;
      }

      // Dedup: if the `message` event already ran analysis for this (channel, ts), skip
      if (wasProcessed(channelId, msg.ts)) {
        logger.info({ channel: channelId, ts: msg.ts }, 'file_shared: already analyzed via message event — skipping');
        return;
      }

      syntheticEvent = {
        type:  'message',
        user:  msg.user || userId,
        channel: channelId,
        ts:    msg.ts,
        text:  msg.text || '',
        files: msg.files || [],
      };
      logger.info({
        channel: channelId,
        ts: msg.ts,
        fileCount: syntheticEvent.files.length,
        hasText: !!syntheticEvent.text,
        textLength: syntheticEvent.text.length,
      }, 'file_shared: fetched originating message');
    } catch (fetchErr) {
      logger.error({ err: fetchErr, channelId, fileId }, 'file_shared: failed to fetch message history');
      return;
    }

    const assessmentFs = await analyzeMessage(syntheticEvent, workspaceId);
    logger.info({
      match: assessmentFs.match,
      confidence: assessmentFs.confidence,
      mismatchType: assessmentFs.mismatchType,
      intentLabel: assessmentFs.intentLabel,
    }, 'file_shared: risk assessment result');

    const evaluationIdFs = await saveEvaluation(syntheticEvent, assessmentFs, 'slack', workspaceId);
    await reactToAssessment(syntheticEvent, assessmentFs, workspaceId, evaluationIdFs);

    // In-memory cleanup
    syntheticEvent.text = null;
    for (const f of syntheticEvent.files) {
      f.url_private = null;
      f.url_private_download = null;
      f.permalink = null;
    }
  } else if (event.type === 'channel_created') {
    const channelId = event.channel?.id;
    if (channelId) {
      logger.info({ channelId, channelName: event.channel.name }, 'New channel created, attempting auto-join');
      joinChannel(channelId, workspaceId).catch((err) => {
        logger.error({ err, channelId }, 'Auto-join on channel_created failed');
      });
    }
  } else if (event.type === 'app_uninstalled' || event.type === 'tokens_revoked') {
    try {
      await deactivateWorkspace(workspaceId);
      invalidateClientCache(workspaceId);
      logger.info({ workspaceId, eventType: event.type }, 'Workspace deactivated');
    } catch (err) {
      logger.error({ err, workspaceId, eventType: event.type }, 'Failed to deactivate workspace');
    }
  } else {
    logger.info({
      event_type: event.type,
      event_ts: event.event_ts,
      channel: event.channel_id || event.channel,
      user: event.user_id || event.user,
      team: event.team || payload.team_id,
    }, 'Slack event');
  }
}

router.post('/events', express.raw({ type: 'application/json' }), (req, res) => {
  let payload;

  try {
    payload = verifyAndParseSlackPayload(req);
  } catch (error) {
    logger.error({ err: error }, 'Slack request verification failed');
    return res.status(401).send('Invalid Slack signature');
  }

  // url_verification must be answered synchronously
  if (payload.type === 'url_verification') {
    logger.info('Slack URL verification handshake');
    return res.status(200).json({ challenge: payload.challenge });
  }

  // Ack immediately, then process async (Slack has a 3-second timeout)
  res.status(200).end();

  if (payload.event) {
    logger.info({
      type: payload.type,
      team_id: payload.team_id,
      api_app_id: payload.api_app_id,
      event_id: payload.event_id,
      event_time: payload.event_time,
      event_type: payload.event.type,
    }, 'Slack event received');

    processEvent(payload).catch((error) => {
      logger.error({ event_id: payload.event_id, err: error }, 'Slack event processing failed');
    });
  }
});

module.exports = router;
