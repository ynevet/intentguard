const { slackClient } = require('./slack-client');
const { getSetting } = require('./db');
const logger = require('./logger');

async function isAutoJoinEnabled(workspaceId = 'default') {
  const setting = await getSetting('slack.auto_join_channels', workspaceId);
  return setting !== 'false';
}

async function getExcludedChannels(workspaceId = 'default') {
  const raw = await getSetting('slack.excluded_channels', workspaceId) || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

async function joinChannel(channelId, workspaceId = 'default') {
  if (!(await isAutoJoinEnabled(workspaceId))) {
    logger.info({ channelId }, 'Auto-join disabled, skipping channel');
    return false;
  }

  const excluded = await getExcludedChannels(workspaceId);
  if (excluded.includes(channelId)) {
    logger.info({ channelId }, 'Channel is excluded, skipping join');
    return false;
  }

  try {
    await slackClient.conversations.join({ channel: channelId });
    logger.info({ channelId }, 'Auto-joined channel');
    return true;
  } catch (err) {
    logger.error({ err, channelId }, 'Failed to auto-join channel');
    return false;
  }
}

async function joinAllPublicChannels(workspaceId = 'default') {
  if (!(await isAutoJoinEnabled(workspaceId))) {
    logger.info('Auto-join channels disabled, skipping sweep');
    return { joined: 0, skipped: 0, failed: 0, alreadyMember: 0 };
  }

  const excluded = await getExcludedChannels(workspaceId);
  const counts = { joined: 0, skipped: 0, failed: 0, alreadyMember: 0 };
  let cursor;

  try {
    do {
      const result = await slackClient.conversations.list({
        types: 'public_channel',
        exclude_archived: true,
        limit: 200,
        cursor,
      });

      for (const channel of (result.channels || [])) {
        if (channel.is_member) {
          counts.alreadyMember++;
          continue;
        }
        if (excluded.includes(channel.id)) {
          counts.skipped++;
          continue;
        }
        try {
          await slackClient.conversations.join({ channel: channel.id });
          counts.joined++;
          logger.info({ channelId: channel.id, channelName: channel.name }, 'Auto-joined channel');
        } catch (joinErr) {
          counts.failed++;
          logger.error({ err: joinErr, channelId: channel.id, channelName: channel.name }, 'Failed to auto-join channel');
        }
      }

      cursor = result.response_metadata?.next_cursor;
    } while (cursor);
  } catch (err) {
    logger.error({ err }, 'Failed to list channels for auto-join sweep');
  }

  logger.info(counts, 'Auto-join channels sweep completed');
  return counts;
}

module.exports = { joinAllPublicChannels, joinChannel };
