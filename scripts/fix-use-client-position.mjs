/**
 * fix-use-client-position.mjs
 * 
 * Asegura que 'use client' sea siempre la primera línea de cada archivo
 * que lo necesite. El import inyectado por fix-missing-imports puede haber
 * quedado antes de la directiva.
 */

import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

const files = globSync('src/**/*.{tsx,ts}', { cwd: process.cwd() });
let fixed = 0;

for (const file of files) {
  const content = readFileSync(file, 'utf8');

  // Si el archivo contiene 'use client' pero NO es la primera línea
  const useClientMatch = content.match(/^(['"]use client['"];?\r?\n)/m);
  if (!useClientMatch) continue;

  // Comprobar si ya está en la primera posición
  if (content.startsWith("'use client'") || content.startsWith('"use client"')) continue;

  // Mover 'use client' al inicio
  const directive = useClientMatch[0];
  const withoutDirective = content.replace(directive, '');
  const fixed_content = directive + withoutDirective;

  writeFileSync(file, fixed_content, 'utf8');
  console.log(`✅ Fixed 'use client' position in: ${file}`);
  fixed++;
}

console.log(`\n✨ ${fixed} files fixed.`);
