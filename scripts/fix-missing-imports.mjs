/**
 * fix-missing-imports.mjs
 * 
 * Para cada archivo que tenga errores de 'Cannot find name Button/Input',
 * añade el import del barrel @/components/ui si no lo tiene ya.
 */

import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

const files = globSync('src/**/*.{tsx,ts}', { cwd: process.cwd() });

// Detectar qué componentes usa cada archivo y cuáles le faltan importar
const COMPONENTS = ['Button', 'Input'];

let fixed = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  let changed = false;

  // Qué componentes del DS se usan como JSX en este archivo
  const usedComponents = COMPONENTS.filter(c => {
    // Buscar uso como JSX: <Button o <Input (no como tipo)
    const jsxPattern = new RegExp(`<${c}[\\s/>]`);
    return jsxPattern.test(content);
  });

  if (usedComponents.length === 0) continue;

  // Qué componentes ya están importados (barrel o individual con cualquier comilla)
  const importedComponents = COMPONENTS.filter(c => {
    const importPattern = new RegExp(`import[^;]*\\b${c}\\b[^;]*from ['"]@/components/ui`);
    return importPattern.test(content);
  });

  // Qué componentes faltan
  const missing = usedComponents.filter(c => !importedComponents.includes(c));
  if (missing.length === 0) continue;

  // Añadir import al inicio del archivo, respetando 'use client'
  const importLine = `import { ${missing.join(', ')} } from '@/components/ui';\n`;

  if (content.startsWith("'use client'") || content.startsWith('"use client"')) {
    // Insertar después de la primera línea 'use client'
    const firstNewline = content.indexOf('\n');
    content = content.slice(0, firstNewline + 1) + importLine + content.slice(firstNewline + 1);
  } else {
    content = importLine + content;
  }

  writeFileSync(file, content, 'utf8');
  console.log(`✅ Added import { ${missing.join(', ')} } to ${file}`);
  fixed++;
}

console.log(`\n✨ ${fixed} files fixed.`);
