const crypto = require('crypto');
const express = require('express');
const logger = require('../lib/logger');
const { getSlackClient, getSlackUserClient, invalidateClientCache } = require('../lib/slack-client');
const { analyzeMessage } = require('../lib/risk-engine');
const { saveEvaluation, recordEvent } = require('../lib/evaluation-store');
const { getSetting, getWorkspace, deactivateWorkspace } = require('../lib/db');
const { joinChannel } = require('../lib/channel-join');

const router = express.Router();

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
      // 1. Silently delete the mismatched files from Slack
      //    Requires the user-token client (user_token with files:write scope)
      //    because bot tokens can only delete files the bot itself uploaded.
      if (event.files && event.files.length > 0) {
        if (!userClient) {
          logger.warn('No user token configured — cannot delete user-uploaded files');
        } else {
          for (const file of event.files) {
            try {
              await userClient.files.delete({ file: file.id });
              logger.info({ fileId: file.id, fileName: file.name, channel: event.channel, user: event.user }, 'Deleted mismatched file');
              // Track file deletion action
              if (evaluationId) {
                recordEvent(evaluationId, workspaceId, 'file_deleted', { fileId: file.id, fileName: file.name });
              }
            } catch (delErr) {
              logger.error({ err: delErr, fileId: file.id, fileName: file.name }, 'Failed to delete mismatched file');
            }
          }
        }
      }

      // 2. DM the sender with full reasoning (always, even if delete failed)
      try {
        const dm = await client.conversations.open({ users: event.user });
        const dmMsg = await client.chat.postMessage({
          channel: dm.channel.id,
          text: `:no_entry_sign: *Intentify AI — File removed* (${confidencePct}% confidence)\n\nA file you shared in <#${event.channel}> was removed because it may not match what you described.\n\n*Reasoning:*\n${assessment.reasoning}${contextRiskLabel}\n\n*Files removed:*\n${fileDetails}`,
        });
        logger.info({ user: event.user, channel: event.channel }, 'Sent mismatch DM to user');
        // Track DM sent action
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

  // Resolve workspace from team_id: DB lookup first, fall back to 'default' if env vars set
  let workspaceId = 'default';
  const teamId = payload.team_id;
  if (teamId) {
    const workspace = await getWorkspace(teamId);
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
