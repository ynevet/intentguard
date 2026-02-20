const { parseOffice } = require('officeparser');

async function extract(buffer) {
  const text = await parseOffice(buffer);
  return (typeof text === 'string' ? text : '').trim() || null;
}

module.exports = { extract };
