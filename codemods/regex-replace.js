const fs = require('fs');
const path = require('path');

const DIR = 'src';

// Regex para buscar clases de tailwind (incluso precedidas por prefijos, omitiendo dark)
const BORDER_RE = /(?:(?:hover|focus|active|md|sm|lg|xl|2xl):)?border-(?:gray|slate|zinc|neutral)-[0-9]{2,3}/g;
const DIVIDE_RE = /(?:(?:hover|focus|active|md|sm|lg|xl|2xl):)?divide-(?:gray|slate|zinc|neutral)-[0-9]{2,3}/g;
const TEXT_RE = /((?:(?:hover|focus|active|md|sm|lg|xl|2xl):)?(?:dark:)?(?:hover:)?(?:focus:)?)text-(?:gray|slate|zinc|neutral)-(\d{2,3})/g;
const BG_RE = /((?:(?:hover|focus|active|md|sm|lg|xl|2xl):)?(?:dark:)?(?:hover:)?(?:focus:)?)bg-(?:gray|slate|zinc|neutral)-(\d{2,3})/g;
const SHADOW_RE = /(?:(?:hover|focus|active|md|sm|lg|xl|2xl):)?shadow-(sm|md|lg)/g;

function cleanPrefix(prefix) {
  if (!prefix) return '';
  return prefix.replace(/dark:/g, '');
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 1. Borders
  content = content.replace(BORDER_RE, (match) => {
    const prefixMatch = match.match(/^(.*?)(?:dark:)?border-/);
    const prefix = prefixMatch ? cleanPrefix(prefixMatch[1]) : '';
    return prefix + "border-[var(--hp-border-subtle)]";
  });

  // 2. Divides
  content = content.replace(DIVIDE_RE, (match) => {
    const prefixMatch = match.match(/^(.*?)(?:dark:)?divide-/);
    const prefix = prefixMatch ? cleanPrefix(prefixMatch[1]) : '';
    return prefix + "divide-[var(--hp-border-subtle)]";
  });

  // 3. Text
  content = content.replace(TEXT_RE, (match, p1, p2) => {
    const prefix = cleanPrefix(p1);
    const level = parseInt(p2, 10);
    if (level >= 800) return prefix + "text-[var(--hp-text-primary)]";
    if (level >= 600) return prefix + "text-[var(--hp-text-secondary)]";
    if (level >= 400) return prefix + "text-[var(--hp-text-tertiary)]";
    return prefix + "text-[var(--hp-text-muted)]";
  });

  // 4. Backgrounds
  content = content.replace(BG_RE, (match, p1, p2) => {
    const prefix = cleanPrefix(p1);
    const level = parseInt(p2, 10);
    if (level <= 100) return prefix + "bg-[var(--hp-bg-page)]";
    if (level <= 300) return prefix + "bg-[var(--hp-bg-surface)]";
    return prefix + "bg-[var(--hp-bg-surface)]";
  });

  // 5. Shadows
  content = content.replace(SHADOW_RE, (match) => {
    const prefixMatch = match.match(/^(.*?)shadow-/);
    const prefix = prefixMatch ? prefixMatch[1] : '';
    // We only replace shadow-sm, shadow-md, shadow-lg with hp-shadow-md
    return prefix + "shadow-[var(--hp-shadow-md)]";
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
