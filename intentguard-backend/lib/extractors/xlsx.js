const XLSX = require('xlsx');

async function extract(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const lines = [];
  // Extract text from first 3 sheets max
  const sheets = workbook.SheetNames.slice(0, 3);
  for (const name of sheets) {
    const sheet = workbook.Sheets[name];
    const text = XLSX.utils.sheet_to_csv(sheet);
    if (text.trim()) {
      lines.push(`[Sheet: ${name}]`);
      lines.push(text.trim());
    }
  }
  const result = lines.join('\n');
  return result || null;
}

module.exports = { extract };
