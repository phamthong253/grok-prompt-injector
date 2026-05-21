const fs = require('fs');

function collectFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const path = `${dir}/${entry.name}`.replace(/^\.\//, '');
    if (entry.isDirectory()) files.push(...collectFiles(path));
    else if (/\.(html|js)$/i.test(entry.name)) files.push(path);
  }
  return files;
}

const files = collectFiles('.');

const badTokens = [
  ['\\u00C3', '\u00C3'],
  ['\\u00C2', '\u00C2'],
  ['\\u00E2\\u20AC', '\u00E2\u20AC'],
  ['\\u00F0\\u0178', '\u00F0\u0178'],
  ['\\u00E1\\u00BA', '\u00E1\u00BA'],
  ['\\u00E1\\u00BB', '\u00E1\u00BB'],
  ['\\u00C4\\u2018', '\u00C4\u2018'],
  ['\\u00C4', '\u00C4'],
  ['\\uFFFD', '\uFFFD'],
];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const [label, token] of badTokens) {
    if (text.includes(token)) {
      throw new Error(`${file} contains mojibake token: ${label}`);
    }
  }
}

console.log('Encoding check passed');
