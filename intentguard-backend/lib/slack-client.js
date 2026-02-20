const { WebClient } = require('@slack/web-api');

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

// User-token client for privileged actions (e.g. deleting user-uploaded files).
// Bot tokens can only delete content the bot itself created; a user token
// with files:write scope is required to delete files uploaded by users.
const slackUserClient = process.env.SLACK_USER_TOKEN
  ? new WebClient(process.env.SLACK_USER_TOKEN)
  : null;

module.exports = { slackClient, slackUserClient };
