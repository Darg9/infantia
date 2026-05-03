#!/usr/bin/env node
/**
 * DS Guard — Design System Color Enforcement
 * Cross-platform alternative to grep for ds:check script.
 * Scans src/ for hardcoded Tailwind color classes.
 * Exit 1 if violations found, exit 0 if clean.
 */
const fs = require('fs');
const path = require('path');

const COLOR_PATTERN = /\b(bg|text|border|ring|divide)-(gray|slate|zinc|neutral|red|green|blue|yellow|emerald|indigo|violet|teal|amber|rose|fuchsia|sky|cyan|lime|orange)-\d/g;

// Allowed patterns — these are DS tokens, not raw Tailwind
const ALLOWED_PATTERNS = [
  // DS semantic tokens (success, error, warning, info, brand)
  /(bg|text|border|ring|divide)-(success|error|warning|info|brand)-/,
];

// Files/dirs to exclude from scan
const EXCLUDED = [
  'node_modules', '.next', 'out', 'build',
  '.git', 'coverage', 'storybook-static',
  'codemods', // our own migration scripts
];

function isAllowed(match) {
  return ALLOWED_PATTERNS.some(p => p.test(match));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  lines.forEach((line, i) => {
    const matches = [...line.matchAll(COLOR_PATTERN)];
    for (const match of matches) {
      if (!isAllowed(match[0])) {
        violations.push({ line: i + 1, text: line.trim(), match: match[0] });
      }
    }
  });

  return violations;
}

function walkDir(dir) {
  let allViolations = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED.includes(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      allViolations = allViolations.concat(walkDir(fullPath));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      const violations = scanFile(fullPath);
      if (violations.length > 0) {
        allViolations.push({ file: fullPath, violations });
      }
    }
  }

  return allViolations;
}

const srcDir = path.join(process.cwd(), 'src');
const results = walkDir(srcDir);

if (results.length === 0) {
  console.log('✅ DS Guard: sin violaciones de tokens. Repo 100% DS-compliant.');
  process.exit(0);
} else {
  console.error('❌ DS Guard: colores Tailwind directos encontrados:\n');
  for (const { file, violations } of results) {
    const relPath = path.relative(process.cwd(), file);
    for (const v of violations) {
      console.error(`  ${relPath}:${v.line} → "${v.match}" en: ${v.text.substring(0, 80)}`);
    }
  }
  const total = results.reduce((acc, r) => acc + r.violations.length, 0);
  console.error(`\n→ ${total} violación(es) en ${results.length} archivo(s). Usa tokens hp-* del DS.`);
  process.exit(1);
}
