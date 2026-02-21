const { WebClient } = require('@slack/web-api');
const logger = require('./logger');

// Per-workspace client caches
const botClients = new Map();
const userClients = new Map();

// Lazy require to avoid circular dependency at module load
let _db;
function db() {
  if (!_db) _db = require('./db');
  return _db;
}

async function getSlackClient(workspaceId = 'default') {
  if (botClients.has(workspaceId)) return botClients.get(workspaceId);

  let token;
  if (workspaceId === 'default') {
    // Check DB first, fall back to env var
    const workspace = await db().getWorkspace('default');
    token = workspace?.bot_token || process.env.SLACK_BOT_TOKEN;
  } else {
    const workspace = await db().getWorkspace(workspaceId);
    token = workspace?.bot_token;
  }

  if (!token) {
    logger.warn({ workspaceId }, 'No bot token available for workspace');
    return null;
  }

  const client = new WebClient(token);
  botClients.set(workspaceId, client);
  return client;
}

async function getSlackUserClient(workspaceId = 'default') {
  if (userClients.has(workspaceId)) return userClients.get(workspaceId);

  let token;
  if (workspaceId === 'default') {
    const workspace = await db().getWorkspace('default');
    token = workspace?.user_token || process.env.SLACK_USER_TOKEN;
  } else {
    const workspace = await db().getWorkspace(workspaceId);
    token = workspace?.user_token;
  }

  if (!token) {
    // No user client — not an error, just optional
    userClients.set(workspaceId, null);
    return null;
  }

  const client = new WebClient(token);
  userClients.set(workspaceId, client);
  return client;
}

async function getBotToken(workspaceId = 'default') {
  if (workspaceId === 'default') {
    const workspace = await db().getWorkspace('default');
    return workspace?.bot_token || process.env.SLACK_BOT_TOKEN || null;
  }
  const workspace = await db().getWorkspace(workspaceId);
  return workspace?.bot_token || null;
}

function invalidateClientCache(workspaceId) {
  botClients.delete(workspaceId);
  userClients.delete(workspaceId);
}

module.exports = { getSlackClient, getSlackUserClient, getBotToken, invalidateClientCache };
