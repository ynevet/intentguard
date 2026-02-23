const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { preScan } = require('../lib/pre-scan');

// Helper: build a file metadata object
function file(name, mimetype = 'application/octet-stream', size = 1000) {
  return { name, mimetype, size };
}

// Helper: build an extracted file object
function extracted(name, text, mimetype = 'text/plain') {
  return { name, text, mimetype };
}

// ── Verdict logic ──────────────────────────────────────────────────

describe('preScan verdict logic', () => {
  it('returns clean for innocuous text', () => {
    const result = preScan('Here are the meeting notes', [], [file('notes.txt')]);
    assert.equal(result.verdict, 'clean');
    assert.equal(result.findings.length, 0);
  });

  it('returns clean for empty inputs', () => {
    const result = preScan('', [], []);
    assert.equal(result.verdict, 'clean');
  });

  it('returns mismatch for critical findings (short-circuits LLM)', () => {
    const text = 'My SSN is 123-45-6789';
    const result = preScan('check this', [extracted('doc.txt', text)], [file('doc.txt')]);
    assert.equal(result.verdict, 'mismatch');
    assert.ok(result.confidence >= 0.9);
  });

  it('returns signals_only for high-severity non-critical findings', () => {
    // Risky filename alone is high severity, not critical → signals_only
    const result = preScan('here you go', [], [file('.env')]);
    assert.equal(result.verdict, 'signals_only');
    assert.ok(result.findings.length > 0);
  });
});

// ── Credit card detection ──────────────────────────────────────────

describe('credit card detection', () => {
  it('detects valid Visa number', () => {
    const result = preScan('', [extracted('f.txt', 'card: 4532015112830366')], []);
    assert.ok(result.findings.some((f) => f.type === 'credit_card'));
  });

  it('detects valid Mastercard number', () => {
    const result = preScan('', [extracted('f.txt', 'card: 5425233430109903')], []);
    assert.ok(result.findings.some((f) => f.type === 'credit_card'));
  });

  it('detects valid Amex number', () => {
    const result = preScan('', [extracted('f.txt', 'card: 374245455400126')], []);
    assert.ok(result.findings.some((f) => f.type === 'credit_card'));
  });

  it('detects Amex number with spaces (4-6-5 format)', () => {
    const result = preScan('', [extracted('f.txt', '3742 454554 00126')], []);
    assert.ok(result.findings.some((f) => f.type === 'credit_card'));
  });

  it('rejects invalid Luhn numbers', () => {
    const result = preScan('', [extracted('f.txt', 'card: 4532015112830367')], []);
    assert.ok(!result.findings.some((f) => f.type === 'credit_card'));
  });

  it('detects card numbers with spaces', () => {
    const result = preScan('', [extracted('f.txt', '4532 0151 1283 0366')], []);
    assert.ok(result.findings.some((f) => f.type === 'credit_card'));
  });

  it('detects card numbers with dashes', () => {
    const result = preScan('', [extracted('f.txt', '4532-0151-1283-0366')], []);
    assert.ok(result.findings.some((f) => f.type === 'credit_card'));
  });

  it('credit card finding has critical severity', () => {
    const result = preScan('', [extracted('f.txt', '4532015112830366')], []);
    const cc = result.findings.find((f) => f.type === 'credit_card');
    assert.equal(cc.severity, 'critical');
  });

  it('masks card number in sample', () => {
    const result = preScan('', [extracted('f.txt', '4532015112830366')], []);
    const cc = result.findings.find((f) => f.type === 'credit_card');
    assert.ok(cc.sample.includes('****'));
    assert.ok(!cc.sample.includes('4532015112830366'));
  });
});

// ── SSN detection ──────────────────────────────────────────────────

describe('SSN detection', () => {
  it('detects US SSN format', () => {
    const result = preScan('', [extracted('f.txt', 'SSN: 123-45-6789')], []);
    assert.ok(result.findings.some((f) => f.type === 'ssn'));
  });

  it('counts multiple SSNs', () => {
    const text = '123-45-6789\n987-65-4321\n111-22-3333';
    const result = preScan('', [extracted('f.txt', text)], []);
    const ssn = result.findings.find((f) => f.type === 'ssn');
    assert.equal(ssn.count, 3);
  });

  it('does not match non-SSN patterns', () => {
    const result = preScan('', [extracted('f.txt', 'phone: 123-456-7890')], []);
    assert.ok(!result.findings.some((f) => f.type === 'ssn'));
  });

  it('SSN finding has critical severity', () => {
    const result = preScan('', [extracted('f.txt', '123-45-6789')], []);
    const ssn = result.findings.find((f) => f.type === 'ssn');
    assert.equal(ssn.severity, 'critical');
  });
});

// ── UK NINO detection ──────────────────────────────────────────────

describe('UK NINO detection', () => {
  it('detects UK National Insurance Number', () => {
    const result = preScan('', [extracted('f.txt', 'NINO: AB 12 34 56 C')], []);
    assert.ok(result.findings.some((f) => f.type === 'uk_nino'));
  });

  it('detects NINO without spaces', () => {
    const result = preScan('', [extracted('f.txt', 'AB123456C')], []);
    assert.ok(result.findings.some((f) => f.type === 'uk_nino'));
  });
});

// ── API key detection ──────────────────────────────────────────────

describe('API key detection', () => {
  it('detects OpenAI API key', () => {
    const result = preScan('', [extracted('f.txt', 'sk-abc123def456ghi789jklmnopqrst')], []);
    assert.ok(result.findings.some((f) => f.type === 'api_key'));
  });

  it('detects AWS access key', () => {
    const result = preScan('', [extracted('f.txt', 'AKIAIOSFODNN7EXAMPLE')], []);
    assert.ok(result.findings.some((f) => f.type === 'api_key'));
  });

  it('detects GitHub PAT', () => {
    const result = preScan('', [extracted('f.txt', 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij')], []);
    assert.ok(result.findings.some((f) => f.type === 'api_key'));
  });

  it('detects Slack token', () => {
    const result = preScan('', [extracted('f.txt', 'xoxb-12345678-abcdefghij')], []);
    assert.ok(result.findings.some((f) => f.type === 'api_key'));
  });

  it('detects Stripe secret key', () => {
    const result = preScan('', [extracted('f.txt', 'sk_live_ABCDEFGHIJKLMNOPQRSTUVWXyz')], []);
    assert.ok(result.findings.some((f) => f.type === 'api_key'));
  });

  it('detects GitLab PAT', () => {
    const result = preScan('', [extracted('f.txt', 'glpat-xxxxxxxxxxxxxxxxxxxx')], []);
    assert.ok(result.findings.some((f) => f.type === 'api_key'));
  });

  it('API key finding has critical severity', () => {
    const result = preScan('', [extracted('f.txt', 'sk-abc123def456ghi789jklmnopqrst')], []);
    const key = result.findings.find((f) => f.type === 'api_key');
    assert.equal(key.severity, 'critical');
  });

  it('also scans message text for API keys', () => {
    const result = preScan('here is key sk-abc123def456ghi789jklmnopqrst', [], []);
    assert.ok(result.findings.some((f) => f.type === 'api_key'));
  });
});

// ── Private key detection ──────────────────────────────────────────

describe('private key detection', () => {
  it('detects RSA private key', () => {
    const result = preScan('', [extracted('f.txt', '-----BEGIN RSA PRIVATE KEY-----\nMIIE...')], []);
    assert.ok(result.findings.some((f) => f.type === 'private_key'));
  });

  it('detects OpenSSH private key', () => {
    const result = preScan('', [extracted('f.txt', '-----BEGIN OPENSSH PRIVATE KEY-----\nb3Bl...')], []);
    assert.ok(result.findings.some((f) => f.type === 'private_key'));
  });

  it('detects EC private key', () => {
    const result = preScan('', [extracted('f.txt', '-----BEGIN EC PRIVATE KEY-----\nMHQC...')], []);
    assert.ok(result.findings.some((f) => f.type === 'private_key'));
  });

  it('detects generic private key marker', () => {
    const result = preScan('', [extracted('f.txt', '-----BEGIN PRIVATE KEY-----\nMIIE...')], []);
    assert.ok(result.findings.some((f) => f.type === 'private_key'));
  });

  it('private key finding has critical severity', () => {
    const result = preScan('', [extracted('f.txt', '-----BEGIN PRIVATE KEY-----\nMIIE...')], []);
    const pk = result.findings.find((f) => f.type === 'private_key');
    assert.equal(pk.severity, 'critical');
  });
});

// ── Password detection ─────────────────────────────────────────────

describe('password detection', () => {
  it('detects password=value pattern', () => {
    const result = preScan('', [extracted('f.txt', 'password=supersecret123')], []);
    assert.ok(result.findings.some((f) => f.type === 'password_in_plaintext'));
  });

  it('detects PASSWORD: value pattern', () => {
    const result = preScan('', [extracted('f.txt', 'DB_PASSWORD: mydbpass')], []);
    assert.ok(result.findings.some((f) => f.type === 'password_in_plaintext'));
  });

  it('detects secret=value pattern', () => {
    const result = preScan('', [extracted('f.txt', 'secret=abc123xyz')], []);
    assert.ok(result.findings.some((f) => f.type === 'password_in_plaintext'));
  });

  it('also scans message text for passwords', () => {
    const result = preScan('password=oops123', [], []);
    assert.ok(result.findings.some((f) => f.type === 'password_in_plaintext'));
  });
});

// ── .env file content detection ────────────────────────────────────

describe('.env file content detection', () => {
  it('detects .env-style content (3+ KEY=value lines)', () => {
    const text = 'DATABASE_URL=postgres://localhost\nSECRET_KEY=abc\nPORT=3000';
    const result = preScan('', [extracted('config.txt', text)], []);
    assert.ok(result.findings.some((f) => f.type === 'env_file_content'));
  });

  it('does not flag fewer than 3 KEY=value lines', () => {
    const text = 'PORT=3000\nNODE_ENV=dev';
    const result = preScan('', [extracted('config.txt', text)], []);
    assert.ok(!result.findings.some((f) => f.type === 'env_file_content'));
  });
});

// ── Bulk email detection ───────────────────────────────────────────

describe('bulk email detection', () => {
  it('detects 10+ email addresses as bulk PII', () => {
    const emails = Array.from({ length: 12 }, (_, i) => `user${i}@example.com`).join('\n');
    const result = preScan('', [extracted('contacts.csv', emails)], []);
    assert.ok(result.findings.some((f) => f.type === 'bulk_emails'));
  });

  it('does not flag fewer than 10 emails', () => {
    const emails = Array.from({ length: 5 }, (_, i) => `user${i}@example.com`).join('\n');
    const result = preScan('', [extracted('contacts.csv', emails)], []);
    assert.ok(!result.findings.some((f) => f.type === 'bulk_emails'));
  });

  it('bulk emails finding reports count', () => {
    const emails = Array.from({ length: 15 }, (_, i) => `user${i}@example.com`).join('\n');
    const result = preScan('', [extracted('f.txt', emails)], []);
    const be = result.findings.find((f) => f.type === 'bulk_emails');
    assert.equal(be.count, 15);
  });
});

// ── Bulk phone detection ───────────────────────────────────────────

describe('bulk phone detection', () => {
  it('detects 10+ phone numbers as bulk PII', () => {
    const phones = Array.from({ length: 12 }, (_, i) => `+1-555-${String(i).padStart(3, '0')}-${String(i * 11).padStart(4, '0')}`).join('\n');
    const result = preScan('', [extracted('contacts.csv', phones)], []);
    assert.ok(result.findings.some((f) => f.type === 'bulk_phones'));
  });

  it('does not flag fewer than 10 phone numbers', () => {
    const phones = 'Call 555-123-4567 or 555-987-6543';
    const result = preScan('', [extracted('f.txt', phones)], []);
    assert.ok(!result.findings.some((f) => f.type === 'bulk_phones'));
  });
});

// ── High entropy token detection ───────────────────────────────────

describe('high entropy token detection', () => {
  it('detects high-entropy tokens (random-looking strings)', () => {
    // This is a random base64-like token with high entropy
    const token = 'aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2u';
    const result = preScan('', [extracted('f.txt', `token: ${token}`)], []);
    assert.ok(result.findings.some((f) => f.type === 'high_entropy_token'));
  });

  it('does not flag all-lowercase words', () => {
    const result = preScan('', [extracted('f.txt', 'internationalization')], []);
    assert.ok(!result.findings.some((f) => f.type === 'high_entropy_token'));
  });

  it('does not flag ALL_CAPS constants', () => {
    const result = preScan('', [extracted('f.txt', 'MAX_RETRY_TIMEOUT_MS')], []);
    assert.ok(!result.findings.some((f) => f.type === 'high_entropy_token'));
  });
});

// ── Risky filename detection ───────────────────────────────────────

describe('risky filename detection', () => {
  it('detects .env file', () => {
    const result = preScan('config', [], [file('.env')]);
    assert.ok(result.findings.some((f) => f.type === 'risky_filename'));
  });

  it('detects .env.local variant', () => {
    const result = preScan('config', [], [file('.env.local')]);
    assert.ok(result.findings.some((f) => f.type === 'risky_filename'));
  });

  it('detects .env.prod variant', () => {
    const result = preScan('config', [], [file('.env.prod')]);
    assert.ok(result.findings.some((f) => f.type === 'risky_filename'));
  });

  it('detects passwords.csv', () => {
    const result = preScan('list', [], [file('passwords.csv')]);
    assert.ok(result.findings.some((f) => f.type === 'risky_filename'));
  });

  it('detects credentials.json', () => {
    const result = preScan('config', [], [file('credentials.json')]);
    assert.ok(result.findings.some((f) => f.type === 'risky_filename'));
  });

  it('detects id_rsa', () => {
    const result = preScan('key', [], [file('id_rsa')]);
    assert.ok(result.findings.some((f) => f.type === 'risky_filename'));
  });

  it('detects .pem files', () => {
    const result = preScan('cert', [], [file('server.pem')]);
    assert.ok(result.findings.some((f) => f.type === 'risky_filename'));
  });

  it('detects service account JSON', () => {
    const result = preScan('config', [], [file('service-account-prod.json')]);
    assert.ok(result.findings.some((f) => f.type === 'risky_filename'));
  });

  it('detects .npmrc', () => {
    const result = preScan('config', [], [file('.npmrc')]);
    assert.ok(result.findings.some((f) => f.type === 'risky_filename'));
  });

  it('detects kubeconfig', () => {
    const result = preScan('config', [], [file('kubeconfig')]);
    assert.ok(result.findings.some((f) => f.type === 'risky_filename'));
  });

  it('does not flag normal filenames', () => {
    const result = preScan('notes', [], [file('meeting-notes.pdf')]);
    assert.ok(!result.findings.some((f) => f.type === 'risky_filename'));
  });

  it('tags finding with fileName', () => {
    const result = preScan('config', [], [file('.env')]);
    const rf = result.findings.find((f) => f.type === 'risky_filename');
    assert.equal(rf.fileName, '.env');
  });
});

// ── Mismatch type classification ───────────────────────────────────

describe('mismatch type classification', () => {
  it('classifies API key as credential_leak', () => {
    const result = preScan('', [extracted('f.txt', 'sk-abc123def456ghi789jklmnopqrst')], []);
    assert.equal(result.mismatchType, 'credential_leak');
  });

  it('classifies private key as credential_leak', () => {
    const result = preScan('', [extracted('f.txt', '-----BEGIN PRIVATE KEY-----\nMIIE...')], []);
    assert.equal(result.mismatchType, 'credential_leak');
  });

  it('classifies SSN as pii_exposure', () => {
    const result = preScan('', [extracted('f.txt', 'SSN: 123-45-6789')], []);
    assert.equal(result.mismatchType, 'pii_exposure');
  });

  it('classifies .env filename as credential_leak', () => {
    const result = preScan('config', [], [file('.env')]);
    assert.equal(result.mismatchType, 'credential_leak');
  });

  it('clean result has mismatchType none', () => {
    const result = preScan('hello', [], [file('notes.txt')]);
    assert.equal(result.mismatchType, 'none');
  });
});

// ── Multi-source scanning ──────────────────────────────────────────

describe('multi-source scanning', () => {
  it('scans message text for inline secrets', () => {
    const result = preScan('here is my SSN 123-45-6789', [], []);
    assert.ok(result.findings.some((f) => f.type === 'ssn'));
  });

  it('scans multiple extracted files', () => {
    const result = preScan('docs', [
      extracted('a.txt', '123-45-6789'),
      extracted('b.txt', 'sk-abc123def456ghi789jklmnopqrst'),
    ], []);
    assert.ok(result.findings.some((f) => f.type === 'ssn'));
    assert.ok(result.findings.some((f) => f.type === 'api_key'));
  });

  it('combines filename + content findings', () => {
    const result = preScan('config', [extracted('.env', 'DATABASE_URL=pg://\nSECRET=x\nPORT=3000')], [file('.env')]);
    assert.ok(result.findings.some((f) => f.type === 'risky_filename'));
    assert.ok(result.findings.some((f) => f.type === 'env_file_content'));
  });

  it('tags file findings with source fileName', () => {
    const result = preScan('', [extracted('secrets.txt', '123-45-6789')], []);
    const ssn = result.findings.find((f) => f.type === 'ssn');
    assert.equal(ssn.fileName, 'secrets.txt');
  });

  it('tags message text findings with source', () => {
    const result = preScan('password=oops123', [], []);
    const pw = result.findings.find((f) => f.type === 'password_in_plaintext');
    assert.equal(pw.source, 'message_text');
  });
});

// ── Confidence scoring ─────────────────────────────────────────────

describe('confidence scoring', () => {
  it('critical findings produce confidence >= 0.95', () => {
    const result = preScan('', [extracted('f.txt', '123-45-6789')], []);
    assert.ok(result.confidence >= 0.95);
  });

  it('high-severity-only findings produce confidence >= 0.80', () => {
    const result = preScan('config', [], [file('.env')]);
    assert.ok(result.confidence >= 0.80);
  });
});
