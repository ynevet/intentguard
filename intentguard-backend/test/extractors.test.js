const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { canExtract, extractText, MAX_FILE_SIZE, MAX_TEXT_CHARS } = require('../lib/extractors');

// ── canExtract() ───────────────────────────────────────────────────

describe('canExtract', () => {
  it('returns true for supported mimetypes under size limit', () => {
    const supported = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'text/csv',
      'text/plain',
      'text/markdown',
      'application/json',
      'text/xml',
      'application/xml',
      'text/yaml',
      'application/x-yaml',
      'text/html',
    ];

    for (const mimetype of supported) {
      assert.equal(canExtract({ mimetype, size: 1000 }), true, `expected true for ${mimetype}`);
    }
  });

  it('returns false for unsupported mimetypes', () => {
    const unsupported = [
      'image/png',
      'image/jpeg',
      'video/mp4',
      'application/zip',
      'application/octet-stream',
    ];

    for (const mimetype of unsupported) {
      assert.equal(canExtract({ mimetype, size: 1000 }), false, `expected false for ${mimetype}`);
    }
  });

  it('returns false when file exceeds MAX_FILE_SIZE', () => {
    assert.equal(canExtract({ mimetype: 'text/plain', size: MAX_FILE_SIZE + 1 }), false);
  });

  it('returns true when file is exactly MAX_FILE_SIZE', () => {
    assert.equal(canExtract({ mimetype: 'text/plain', size: MAX_FILE_SIZE }), true);
  });

  it('returns false when mimetype is undefined', () => {
    assert.equal(canExtract({ mimetype: undefined, size: 100 }), false);
  });
});

// ── extractText() for plaintext ────────────────────────────────────

describe('extractText for plaintext', () => {
  it('extracts text from a plain text buffer', async () => {
    const buffer = Buffer.from('Hello, this is a test document.');
    const result = await extractText(buffer, 'text/plain');
    assert.equal(result, 'Hello, this is a test document.');
  });

  it('extracts text from JSON buffer', async () => {
    const json = JSON.stringify({ key: 'value', nested: { a: 1 } });
    const buffer = Buffer.from(json);
    const result = await extractText(buffer, 'application/json');
    assert.equal(result, json);
  });

  it('extracts text from markdown buffer', async () => {
    const md = '# Heading\n\nSome paragraph text.';
    const buffer = Buffer.from(md);
    const result = await extractText(buffer, 'text/markdown');
    assert.equal(result, md);
  });

  it('truncates text exceeding MAX_TEXT_CHARS', async () => {
    const longText = 'x'.repeat(MAX_TEXT_CHARS + 500);
    const buffer = Buffer.from(longText);
    const result = await extractText(buffer, 'text/plain');
    assert.ok(result.length <= MAX_TEXT_CHARS + 20); // +20 for truncation marker
    assert.ok(result.endsWith('[...truncated]'));
  });

  it('returns null for unsupported mimetype', async () => {
    const buffer = Buffer.from('data');
    const result = await extractText(buffer, 'application/octet-stream');
    assert.equal(result, null);
  });

  it('handles empty buffer', async () => {
    const buffer = Buffer.from('');
    const result = await extractText(buffer, 'text/plain');
    // Empty string or null are both acceptable
    assert.ok(result === '' || result === null);
  });

  it('handles UTF-8 text correctly', async () => {
    const text = 'Caf\u00e9 na\u00efve r\u00e9sum\u00e9 \u2014 \u00fcber co\u00f6perate';
    const buffer = Buffer.from(text, 'utf8');
    const result = await extractText(buffer, 'text/plain');
    assert.equal(result, text);
  });
});

// ── extractText() for CSV ──────────────────────────────────────────

describe('extractText for CSV', () => {
  it('extracts text from CSV buffer', async () => {
    const csv = 'name,email\nAlice,alice@example.com\nBob,bob@example.com';
    const buffer = Buffer.from(csv);
    const result = await extractText(buffer, 'text/csv');
    assert.ok(result !== null);
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('Bob'));
  });
});
