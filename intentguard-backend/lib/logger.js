const pino = require('pino');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');

const targets = [
  {
    level: 'info',
    target: 'pino-roll',
    options: {
      file: path.join(logsDir, 'app.log'),
      frequency: 'daily',
      dateFormat: 'yyyy-MM-dd',
      size: '20m',
      mkdir: true,
      limit: { count: 14 },
    },
  },
  {
    level: 'info',
    target: 'pino-pretty',
    options: { colorize: true },
  },
];

const logger = pino({
  level: 'info',
  redact: {
    paths: [
      // User message content
      'text', 'event.text', 'event_payload.text',
      // AI reasoning (may paraphrase sensitive content)
      'reasoning', 'assessment.reasoning',
      // Slack private file URLs
      'url_private', 'url_private_download', 'permalink',
      'files[*].url_private', 'files[*].url_private_download', 'files[*].permalink',
      'event_payload.files[*].url_private', 'event_payload.files[*].url_private_download',
      // AI file findings (may describe sensitive content)
      'filesAnalyzed[*].finding',
    ],
    censor: '[REDACTED]',
  },
  transport: { targets },
});

module.exports = logger;
