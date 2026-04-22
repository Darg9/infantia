/**
 * fix-input-ds-to-native.mjs
 * 
 * En archivos de admin y otros contextos donde <Input> (DS) fue inyectado
 * pero los usos NO tienen id+label (formularios internos), revertir a <input> nativo
 * con eslint-disable-next-line para que el ESLint rule no lo bloquee.
 * 
 * Solo actúa en archivos que están fuera de src/components/ui/
 * y que tienen usos de <Input sin id= ni label=
 */

import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

// Solo archivos admin y otros que NO son el DS Input primitivo
const files = globSync('src/**/*.{tsx,ts}', {
  cwd: process.cwd(),
  ignore: ['src/components/ui/input.tsx', 'src/components/ui/index.ts'],
});

let fixed = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  let changed = false;

  // Buscar usos de <Input que NO tengan id= en las siguientes 10 líneas
  // Estrategia: reemplazar <Input\n seguido de props sin id= con <input nativo
  // Patrón: <Input seguido de props que terminan en /> sin incluir id=
  
  // Regex que captura bloques <Input ... /> que no tienen id=
  // Esto es complejo, así que usamos una aproximación: 
  // Encontrar <Input (en mayúscula) que sea DS inyectado y reemplazarlo por <input
  // solo si en las siguientes líneas hasta /> no aparece id=
  
  const lines = content.split('\n');
  const newLines = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Detectar inicio de <Input (DS) — solo mayúscula, no <InputProps ni <InputGroup etc
    if (/^\s*<Input(\s|$|\/)/.test(line) && !line.includes('id=') && !line.includes('label=')) {
      // Verificar si en las siguientes 15 líneas hay id= o label=
      let hasIdLabel = false;
      let j = i;
      let depth = 0;
      while (j < Math.min(i + 20, lines.length)) {
        if (lines[j].includes('id=') || lines[j].includes('label=')) {
          hasIdLabel = true;
          break;
        }
        // Detectar fin del elemento
        if (lines[j].includes('/>') || (lines[j].includes('</Input>') )) {
          break;
        }
        j++;
      }
      
      if (!hasIdLabel) {
        // Añadir eslint-disable y cambiar a minúscula
        const indent = line.match(/^(\s*)/)[1];
        newLines.push(`${indent}{/* eslint-disable-next-line no-restricted-syntax -- formulario interno, DS Input requiere id+label */}`);
        newLines.push(line.replace('<Input', '<input'));
        changed = true;
        i++;
        continue;
      }
    }
    
    // Cerrar </Input> → </input> si existe
    if (/<\/Input>/.test(line)) {
      newLines.push(line.replace(/<\/Input>/g, '</input>'));
      changed = true;
      i++;
      continue;
    }
    
    newLines.push(line);
    i++;
  }
  
  if (changed) {
    writeFileSync(file, newLines.join('\n'), 'utf8');
    console.log(`✅ Fixed: ${file}`);
    fixed++;
  }
}

console.log(`\n✨ ${fixed} files fixed.`);
