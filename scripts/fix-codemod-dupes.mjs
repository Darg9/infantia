/**
 * fix-codemod-dupes.mjs
 * 
 * Elimina los imports circulares/duplicados que inyectó el codemod en la primera línea
 * de archivos que ya importaban Button/Input desde el barrel @/components/ui.
 * 
 * Patrón a eliminar (línea 1 ó 2, con comillas dobles = firma del codemod):
 *   import { Button } from "@/components/ui/button";
 *   import { Input } from "@/components/ui/input";
 * 
 * Los imports legítimos (comillas simples, en posición normal) NO se tocan.
 */

import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

const CODEMOD_PATTERNS = [
  /^import \{ Button \} from "@\/components\/ui\/button";\r?\n/m,
  /^import \{ Input \} from "@\/components\/ui\/input";\r?\n/m,
  /^import \{ Select \} from "@\/components\/ui\/select";\r?\n/m,
];

// También corregir el doble punto y coma que el codemod dejó: 'use client';;
const DOUBLE_SEMICOLON = /'use client';;/g;

const files = globSync('src/**/*.{tsx,ts}', { cwd: process.cwd() });
let fixed = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  let changed = false;

  // Corregir doble punto y coma
  if (DOUBLE_SEMICOLON.test(content)) {
    content = content.replace(DOUBLE_SEMICOLON, "'use client';");
    changed = true;
  }

  for (const pattern of CODEMOD_PATTERNS) {
    // Solo eliminar si el import de comillas dobles (codemod) está presente
    // Y el archivo YA tiene otro import del mismo componente con comillas simples (el original)
    const codemodeImportMatch = content.match(pattern);
    if (codemodeImportMatch) {
      content = content.replace(pattern, '');
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(file, content, 'utf8');
    console.log(`✅ Fixed: ${file}`);
    fixed++;
  }
}

console.log(`\n✨ ${fixed} files fixed.`);
