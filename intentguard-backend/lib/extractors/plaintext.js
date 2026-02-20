async function extract(buffer) {
  const text = buffer.toString('utf-8').trim();
  return text || null;
}

module.exports = { extract };
