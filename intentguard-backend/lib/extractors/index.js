const logger = require('../logger');

const MAX_TEXT_CHARS = 3000; // ~750 tokens — enough to classify
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB — skip huge files
const EXTRACT_TIMEOUT_MS = 3000; // Hard timeout per file

// Mimetype → extractor module mapping
const EXTRACTOR_MAP = {
  'application/pdf': './pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': './docx',
  'application/msword': './docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': './xlsx',
  'application/vnd.ms-excel': './xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': './pptx',
  'application/vnd.ms-powerpoint': './pptx',
  'text/csv': './csv',
  'text/plain': './plaintext',
  'text/markdown': './plaintext',
  'application/json': './plaintext',
  'text/xml': './plaintext',
  'application/xml': './plaintext',
  'text/yaml': './plaintext',
  'application/x-yaml': './plaintext',
  'text/html': './plaintext',
};

// Lazy-loaded extractors (only require when first needed)
const loadedExtractors = {};

function getExtractor(mimetype) {
  if (!EXTRACTOR_MAP[mimetype]) return null;
  const modulePath = EXTRACTOR_MAP[mimetype];
  if (!loadedExtractors[modulePath]) {
    loadedExtractors[modulePath] = require(modulePath);
  }
  return loadedExtractors[modulePath];
}

function canExtract(file) {
  return !!EXTRACTOR_MAP[file.mimetype] && file.size <= MAX_FILE_SIZE;
}

async function extractText(buffer, mimetype) {
  const extractor = getExtractor(mimetype);
  if (!extractor) return null;

  const extraction = extractor.extract(buffer);

  const result = await Promise.race([
    extraction,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Extraction timeout')), EXTRACT_TIMEOUT_MS)
    ),
  ]).catch((err) => {
    logger.warn({ err: err.message, mimetype }, 'File text extraction failed');
    return null;
  });

  if (!result) return null;

  // Truncate to control token cost
  return result.length > MAX_TEXT_CHARS
    ? result.slice(0, MAX_TEXT_CHARS) + '\n[...truncated]'
    : result;
}

module.exports = { extractText, canExtract, MAX_FILE_SIZE, MAX_TEXT_CHARS };
