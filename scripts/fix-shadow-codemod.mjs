import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

const wrong = 'shadow-[var(--hp-shadow-[var(--hp-shadow-md)])]';
const right  = 'shadow-[var(--hp-shadow-md)]';

const files = globSync('src/**/*.{tsx,ts,css}');
let total = 0, filesFixed = 0;

for (const f of files) {
  const content = readFileSync(f, 'utf8');
  if (!content.includes(wrong)) continue;

  const count = content.split(wrong).length - 1;
  const fixed = content.split(wrong).join(right);
  writeFileSync(f, fixed);
  total += count;
  filesFixed++;
  console.log(`  ✅ ${count} fix(es) → ${f.replace('src/', '')}`);
}

console.log(`\nTotal: ${total} ocurrencias corregidas en ${filesFixed} archivos`);
