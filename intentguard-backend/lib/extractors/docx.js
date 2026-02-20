const mammoth = require('mammoth');

async function extract(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value || '').trim();
  return text || null;
}

module.exports = { extract };
