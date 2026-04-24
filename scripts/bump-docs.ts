import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

// Uso: npx tsx scripts/bump-docs.ts "v0.16.1" "24 de abril de 2026"
// o usando la fecha ISO: npx tsx scripts/bump-docs.ts "v0.16.1" "24 de abril de 2026" "2026-04-24"

const newVersion = process.argv[2];
const newDateStr = process.argv[3];
const newDateIso = process.argv[4] || new Date().toISOString().split('T')[0];

if (!newVersion || !newDateStr) {
  console.error('Uso: npx tsx scripts/bump-docs.ts <nueva_version> <nueva_fecha_texto> [nueva_fecha_iso]');
  console.error('Ejemplo: npx tsx scripts/bump-docs.ts "v0.16.2" "25 de abril de 2026" "2026-04-25"');
  process.exit(1);
}

console.log(`Iniciando actualización a versión ${newVersion} y fecha ${newDateStr} / ${newDateIso}...`);

let updatedCount = 0;

// 1. Archivos legales (TypeScript constants)
const legalFiles = [
  'src/modules/legal/constants/privacy.ts',
  'src/modules/legal/constants/terms.ts',
  'src/modules/legal/constants/data-treatment.ts',
];

legalFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Reemplaza fechas del estilo "24 de abril de 2026"
    const dateRegexStr = /\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}/gi;
    if (dateRegexStr.test(content)) {
      content = content.replace(dateRegexStr, newDateStr);
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(file, content);
      console.log(`[OK] Actualizado archivo legal: ${file}`);
      updatedCount++;
    }
  }
});

// 2. Documentos Markdown (.md) en todo el proyecto
// Ignoramos node_modules, .git, .next, etc.
const docsGlob = globSync('{docs/**/*.md,*.md,Infantia_Claude/**/*.md}', {
  ignore: ['node_modules/**', '.git/**', '.next/**', 'coverage/**', 'playwright-report/**'],
});

docsGlob.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Actualizar versión (Busca patrones como "v0.16.1", "v0.15.0", etc)
  const versionRegex = /v0\.\d+\.\d+/g;
  if (versionRegex.test(content)) {
    content = content.replace(versionRegex, newVersion);
    changed = true;
  }

  // Actualizar fecha en formato "24 de abril de 2026"
  const dateRegexStr = /\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}/gi;
  if (dateRegexStr.test(content)) {
    content = content.replace(dateRegexStr, newDateStr);
    changed = true;
  }

  // Actualizar fecha en formato ISO "2026-04-24"
  const dateRegexIso = /\d{4}-\d{2}-\d{2}/g;
  if (dateRegexIso.test(content)) {
    content = content.replace(dateRegexIso, newDateIso);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`[OK] Actualizado documento: ${file}`);
    updatedCount++;
  }
});

console.log(`\n¡Actualización completada! Se modificaron ${updatedCount} archivos.`);
console.log('Nota: Este script actualiza la METADATA (fechas y versiones). Los cambios profundos de arquitectura o descripciones lógicas deben seguir siendo redactados por el ingeniero/IA.');
