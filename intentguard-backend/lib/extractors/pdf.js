const { PDFParse } = require('pdf-parse');

async function extract(buffer) {
  const parser = new PDFParse({
    data: new Uint8Array(buffer),
    verbosity: 0,
  });

  await parser.load();
  const result = await parser.getText({ first: 5 }); // First 5 pages only

  const text = (result.text || '').trim();
  return text || null;
}

module.exports = { extract };
