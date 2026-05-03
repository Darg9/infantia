const fs = require('fs');
const path = require('path');

const DIR = 'src';

const RING_RE = /(?:(?:hover|focus|active|md|sm|lg|xl|2xl):)?(?:dark:)?ring-(?:gray|slate|zinc|neutral)-[0-9]{2,3}/g;

function cleanPrefix(prefix) {
  if (!prefix) return '';
  return prefix.replace(/dark:/g, '');
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 6. Rings
  content = content.replace(RING_RE, (match) => {
    const prefixMatch = match.match(/^(.*?)(?:dark:)?ring-/);
    const prefix = prefixMatch ? cleanPrefix(prefixMatch[1]) : '';
    return prefix + "ring-[var(--hp-border)]";
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function walkDir(dir) {
  let count = 0;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      count += walkDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      if (processFile(fullPath)) count++;
    }
  }
  return count;
}

const modified = walkDir(DIR);
console.log(`Modificados ${modified} archivos.`);
