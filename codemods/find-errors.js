const { execSync } = require('child_process');
const fs = require('fs');

// Run eslint and capture output
let output;
try {
  output = execSync('npx eslint src/ --quiet', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
} catch (e) {
  output = e.stdout || '';
}

const lines = output.split('\n');
let currentFile = null;
const tailwindErrors = [];

for (const line of lines) {
  // Files show as full paths with whitespace before line numbers
  if (line.match(/^C:\\/)) {
    currentFile = line.trim();
  } else if (line.includes('no-restricted-syntax') && line.includes('Tailwind')) {
    const m = line.match(/(\d+):(\d+)/);
    if (m && currentFile) {
      tailwindErrors.push({ file: currentFile, line: parseInt(m[1]) });
    }
  }
}

// Print unique files with errors
const fileSet = [...new Set(tailwindErrors.map(e => e.file))];
fileSet.forEach(f => {
  const errs = tailwindErrors.filter(e => e.file === f);
  console.log(f.replace(process.cwd() + '\\', ''));
  errs.forEach(e => console.log('  line', e.line));
});

console.log(`\nTotal archivos con errores de token: ${fileSet.length}`);
console.log(`Total errores: ${tailwindErrors.length}`);
