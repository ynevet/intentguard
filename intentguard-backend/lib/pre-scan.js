const logger = require('./logger');

// ── Detector thresholds ──────────────────────────────────────────
const BULK_EMAIL_THRESHOLD = 10;     // 10+ emails in a file = PII dump
const ENTROPY_THRESHOLD = 4.5;       // Shannon entropy bits/char for secret-like tokens
const ENTROPY_MIN_TOKEN_LEN = 16;    // Minimum token length for entropy analysis
const HIGH_CONFIDENCE_MIN_FINDINGS = 1; // 1+ high-severity finding = short-circuit

// ── Regex patterns ───────────────────────────────────────────────

// Credit card numbers (Visa, Mastercard, Amex, Discover)
const CREDIT_CARD_PATTERNS = [
  /\b4[0-9]{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}\b/g,     // Visa
  /\b5[1-5][0-9]{2}[\s-]?[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}\b/g, // Mastercard
  /\b3[47][0-9]{2}[\s-]?[0-9]{6}[\s-]?[0-9]{5}\b/g,                  // Amex (15 digits: 4-6-5)
  /\b6(?:011|5[0-9]{2})[\s-]?[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}\b/g, // Discover
];

// US Social Security Numbers
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

// UK National Insurance Number
const UK_NINO_PATTERN = /\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi;

// Email addresses
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Phone numbers (international and US/EU formats)
const PHONE_PATTERNS = [
  /\b\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,           // US/Canada
  /\b\+?[1-9]\d{0,2}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g, // International
];

// API keys and tokens (known prefixes)
const API_KEY_PATTERNS = [
  /\bsk-[a-zA-Z0-9]{20,}\b/g,                    // OpenAI
  /\bsk-proj-[a-zA-Z0-9_-]{20,}\b/g,             // OpenAI project keys
  /\bAKIA[0-9A-Z]{16}\b/g,                       // AWS Access Key
  /\bghp_[a-zA-Z0-9]{36,}\b/g,                   // GitHub PAT
  /\bgho_[a-zA-Z0-9]{36,}\b/g,                   // GitHub OAuth
  /\bghs_[a-zA-Z0-9]{36,}\b/g,                   // GitHub App
  /\bxox[bpras]-[a-zA-Z0-9-]{10,}\b/g,           // Slack tokens
  /\bglpat-[a-zA-Z0-9_-]{20,}\b/g,               // GitLab PAT
  /\bnpm_[a-zA-Z0-9]{36,}\b/g,                   // npm token
  /\bSG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}\b/g, // SendGrid
  /\bheroku-[a-f0-9-]{36}\b/g,                   // Heroku API key
  /\brk_live_[a-zA-Z0-9]{24,}\b/g,               // Stripe restricted key
  /\bsk_live_[a-zA-Z0-9]{24,}\b/g,               // Stripe secret key
  /\bpk_live_[a-zA-Z0-9]{24,}\b/g,               // Stripe publishable key
  /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g, // JWT tokens
];

// Private keys (PEM markers)
const PRIVATE_KEY_PATTERNS = [
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
  /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/g,
  /-----BEGIN\s+PGP\s+PRIVATE\s+KEY\s+BLOCK-----/g,
  /-----BEGIN\s+EC\s+PRIVATE\s+KEY-----/g,
  /-----BEGIN\s+DSA\s+PRIVATE\s+KEY-----/g,
];

// Passwords in plaintext
const PASSWORD_PATTERNS = [
  /(?:password|passwd|pwd)\s*[:=]\s*\S+/gi,
  /(?:secret|token|api_?key)\s*[:=]\s*\S+/gi,
  /(?:DB_PASSWORD|DATABASE_PASSWORD|MYSQL_PASSWORD|POSTGRES_PASSWORD)\s*[:=]\s*\S+/gi,
];

// .env file content patterns
const ENV_FILE_PATTERNS = [
  /^[A-Z_]{2,}=.+$/gm,  // KEY=value lines (uppercase convention)
];

// ── Filename heuristics (zero cost — no download needed) ─────────
const RISKY_FILENAMES = [
  /^\.env(\.local|\.prod|\.dev|\.staging)?$/i,
  /^passwords?\.(txt|csv|xlsx?|json)$/i,
  /^credentials?\.(txt|csv|json|yaml|yml)$/i,
  /^secrets?\.(txt|csv|json|yaml|yml)$/i,
  /^id_rsa(\.pub)?$/i,
  /^id_ed25519(\.pub)?$/i,
  /^.*\.pem$/i,
  /^.*\.key$/i,
  /^.*\.p12$/i,
  /^.*\.pfx$/i,
  /^.*\.keystore$/i,
  /^token(s)?\.(txt|json)$/i,
  /^api[_-]?key(s)?\.(txt|json)$/i,
  /^private[_-]?key\..+$/i,
  /^service[_-]?account.*\.json$/i,
  /^gcloud.*\.json$/i,
  /^kubeconfig$/i,
  /^\.npmrc$/i,
  /^\.pypirc$/i,
  /^\.netrc$/i,
  /^\.pgpass$/i,
  /^\.git-credentials$/i,
  /^wp-config\.php$/i,
];

// ── Luhn algorithm for credit card validation ────────────────────
function luhnCheck(numStr) {
  const digits = numStr.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(digits)) return false;

  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// ── Shannon entropy calculator ───────────────────────────────────
function shannonEntropy(str) {
  const freq = {};
  for (const ch of str) {
    freq[ch] = (freq[ch] || 0) + 1;
  }
  const len = str.length;
  let entropy = 0;
  for (const ch in freq) {
    const p = freq[ch] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// ── Individual detectors ─────────────────────────────────────────

function detectCreditCards(text) {
  const findings = [];
  for (const pattern of CREDIT_CARD_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern) || [];
    for (const match of matches) {
      if (luhnCheck(match)) {
        const masked = match.replace(/[\s-]/g, '').replace(/^(.{4})(.+)(.{4})$/, '$1****$3');
        findings.push({ type: 'credit_card', sample: masked, severity: 'critical' });
      }
    }
  }
  // Deduplicate by masked sample
  const unique = [...new Map(findings.map((f) => [f.sample, f])).values()];
  return unique;
}

function detectSSN(text) {
  SSN_PATTERN.lastIndex = 0;
  const matches = text.match(SSN_PATTERN) || [];
  if (matches.length === 0) return [];
  return [{ type: 'ssn', count: matches.length, sample: 'XXX-XX-' + matches[0].slice(-4), severity: 'critical' }];
}

function detectNINO(text) {
  UK_NINO_PATTERN.lastIndex = 0;
  const matches = text.match(UK_NINO_PATTERN) || [];
  if (matches.length === 0) return [];
  return [{ type: 'uk_nino', count: matches.length, severity: 'critical' }];
}

function detectBulkEmails(text) {
  EMAIL_PATTERN.lastIndex = 0;
  const matches = text.match(EMAIL_PATTERN) || [];
  if (matches.length < BULK_EMAIL_THRESHOLD) return [];
  return [{ type: 'bulk_emails', count: matches.length, severity: 'high' }];
}

function detectPhoneNumbers(text) {
  let total = 0;
  for (const pattern of PHONE_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern) || [];
    total += matches.length;
  }
  // Only flag if there are many phone numbers (likely a contact list / PII dump)
  if (total < 10) return [];
  return [{ type: 'bulk_phones', count: total, severity: 'high' }];
}

function detectAPIKeys(text) {
  const findings = [];
  for (const pattern of API_KEY_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern) || [];
    for (const match of matches) {
      const prefix = match.slice(0, Math.min(8, match.length)) + '...';
      findings.push({ type: 'api_key', pattern: prefix, severity: 'critical' });
    }
  }
  // Deduplicate by prefix pattern
  return [...new Map(findings.map((f) => [f.pattern, f])).values()];
}

function detectPrivateKeys(text) {
  for (const pattern of PRIVATE_KEY_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return [{ type: 'private_key', severity: 'critical' }];
    }
  }
  return [];
}

function detectPasswords(text) {
  const findings = [];
  for (const pattern of PASSWORD_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern) || [];
    if (matches.length > 0) {
      findings.push({ type: 'password_in_plaintext', count: matches.length, severity: 'critical' });
    }
  }
  return findings.length > 0 ? [findings[0]] : []; // Collapse to one finding
}

function detectEnvFile(text) {
  ENV_FILE_PATTERNS[0].lastIndex = 0;
  const matches = text.match(ENV_FILE_PATTERNS[0]) || [];
  // If many KEY=value lines, it's likely a .env file or config dump
  if (matches.length >= 3) {
    return [{ type: 'env_file_content', count: matches.length, severity: 'high' }];
  }
  return [];
}

function detectHighEntropyTokens(text) {
  // Split into word-like tokens (alphanumeric sequences)
  const tokens = text.match(/[A-Za-z0-9_+/=-]{16,}/g) || [];
  const suspicious = [];

  for (const token of tokens) {
    if (token.length < ENTROPY_MIN_TOKEN_LEN) continue;
    if (token.length > 256) continue; // Skip very long strings (likely encoded data)

    const entropy = shannonEntropy(token);
    if (entropy >= ENTROPY_THRESHOLD) {
      // Verify it's not a common word/path pattern
      if (/^[a-z]+$/i.test(token)) continue; // All lowercase letters = likely a word
      if (/^[A-Z_]+$/.test(token)) continue; // ALL_CAPS = likely a constant name
      if (/^\/|\\/.test(token)) continue;     // File paths

      suspicious.push({
        type: 'high_entropy_token',
        sample: token.slice(0, 8) + '...',
        entropy: Math.round(entropy * 100) / 100,
        severity: 'medium',
      });
    }
  }

  // Cap at 5 findings — we just need to know they exist
  return suspicious.slice(0, 5);
}

function detectRiskyFilenames(files) {
  const findings = [];
  for (const file of files) {
    const name = file.name || '';
    for (const pattern of RISKY_FILENAMES) {
      if (pattern.test(name)) {
        findings.push({
          type: 'risky_filename',
          fileName: name,
          severity: 'high',
        });
        break; // One finding per file is enough
      }
    }
  }
  return findings;
}

// ── Severity → confidence mapping ────────────────────────────────
const SEVERITY_WEIGHTS = {
  critical: 0.95,
  high: 0.80,
  medium: 0.60,
};

// ── Main pre-scan function ───────────────────────────────────────

/**
 * Pre-scan message text, extracted file texts, and file metadata
 * for known sensitive patterns BEFORE calling the LLM.
 *
 * @param {string} messageText - The user's message text
 * @param {Array<{name: string, text: string|null, mimetype: string}>} extractedFiles - Files with extracted text
 * @param {Array<{name: string, mimetype: string, size: number}>} allFiles - All file metadata
 * @returns {{ verdict: string, confidence: number, findings: Array, mismatchType: string }}
 */
function preScan(messageText, extractedFiles = [], allFiles = []) {
  const allFindings = [];

  // 1. Filename heuristics (zero cost — runs on metadata only)
  allFindings.push(...detectRiskyFilenames(allFiles));

  // 2. Scan extracted file text content
  for (const file of extractedFiles) {
    if (!file.text) continue;
    const text = file.text;

    const fileFindings = [
      ...detectCreditCards(text),
      ...detectSSN(text),
      ...detectNINO(text),
      ...detectAPIKeys(text),
      ...detectPrivateKeys(text),
      ...detectPasswords(text),
      ...detectEnvFile(text),
      ...detectBulkEmails(text),
      ...detectPhoneNumbers(text),
      ...detectHighEntropyTokens(text),
    ];

    // Tag each finding with the source file
    for (const finding of fileFindings) {
      finding.fileName = file.name;
    }
    allFindings.push(...fileFindings);
  }

  // 3. Also scan the message text itself (user might paste secrets inline)
  if (messageText) {
    const msgFindings = [
      ...detectAPIKeys(messageText),
      ...detectPrivateKeys(messageText),
      ...detectPasswords(messageText),
      ...detectCreditCards(messageText),
      ...detectSSN(messageText),
    ];
    for (const finding of msgFindings) {
      finding.source = 'message_text';
    }
    allFindings.push(...msgFindings);
  }

  if (allFindings.length === 0) {
    return { verdict: 'clean', confidence: 0, findings: [], mismatchType: 'none' };
  }

  // Calculate overall confidence from highest severity finding
  const maxSeverity = allFindings.reduce(
    (max, f) => Math.max(max, SEVERITY_WEIGHTS[f.severity] || 0),
    0,
  );

  // Determine mismatch type from findings
  const mismatchType = classifyMismatchType(allFindings);

  // Count critical/high findings
  const criticalCount = allFindings.filter((f) => f.severity === 'critical').length;
  const highCount = allFindings.filter((f) => f.severity === 'high').length;

  // If we have critical findings, we can short-circuit (skip LLM)
  if (criticalCount >= HIGH_CONFIDENCE_MIN_FINDINGS) {
    logger.info({
      verdict: 'mismatch',
      confidence: maxSeverity,
      findingCount: allFindings.length,
      criticalCount,
      types: [...new Set(allFindings.map((f) => f.type))],
    }, 'Pre-scan: high-confidence mismatch detected, skipping LLM');

    return {
      verdict: 'mismatch',
      confidence: maxSeverity,
      findings: allFindings,
      mismatchType,
    };
  }

  // If only high/medium findings, pass as hints to LLM
  if (highCount > 0 || allFindings.length > 0) {
    logger.info({
      verdict: 'signals_only',
      findingCount: allFindings.length,
      types: [...new Set(allFindings.map((f) => f.type))],
    }, 'Pre-scan: signals found, will pass as hints to LLM');

    return {
      verdict: 'signals_only',
      confidence: maxSeverity,
      findings: allFindings,
      mismatchType,
    };
  }

  return { verdict: 'clean', confidence: 0, findings: [], mismatchType: 'none' };
}

function classifyMismatchType(findings) {
  const types = new Set(findings.map((f) => f.type));

  if (types.has('api_key') || types.has('private_key') || types.has('password_in_plaintext')) {
    return 'credential_leak';
  }
  if (types.has('credit_card') || types.has('ssn') || types.has('uk_nino') || types.has('bulk_emails') || types.has('bulk_phones')) {
    return 'pii_exposure';
  }
  if (types.has('env_file_content') || types.has('risky_filename')) {
    return 'credential_leak';
  }
  if (types.has('high_entropy_token')) {
    return 'credential_leak';
  }
  return 'none';
}

module.exports = { preScan };
