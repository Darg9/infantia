import fs from 'fs'
import path from 'path'
import { join } from 'path'

// ---- Configuración y Batches ----
const DIRS_TO_SCAN = ['src/app', 'src/components']
const IGNORE_PATTERNS = [/\.test\.tsx?$/, /\.spec\.tsx?$/, /node_modules/, /\/\.next\//, /__tests__/]

// El mapeo de semánticas
const COLOR_MAP: Record<string, string> = {
  orange: 'brand',
  green: 'success',
  red: 'error',
  yellow: 'warning',
  amber: 'warning'
}

// Generamos regex bases
const colorKeys = Object.keys(COLOR_MAP).join('|')

// Batch 1: text-*, bg-* (sin seudo-estados como hover: o focus: adelante, o quizas si lo permitimos para despues, 
//         pero la regla del batch lo aisla)
// OJO: las clases pueden tener whitespace, comillas.
// regex1 match: `\b(text|bg)-(orange|green|red|yellow|amber)-(\d{2,3})\b`

const BATCHES = {
  1: {
    desc: 'text-* y bg-* (excluyendo hover/focus/active)',
    // Matches cosas como: "bg-orange-500", "text-red-500"
    // No matches cosas como: "hover:bg-orange-500" porque obligamos a lookbehind boundary que no sea :
    regex: new RegExp(`(?<!:)\\b(bg|text)-(${colorKeys})-(\\d{2,3})\\b`, 'g')
  },
  2: {
    desc: 'border-* y ring-* (excluyendo hover/focus/active)',
    regex: new RegExp(`(?<!:)\\b(border|ring)-(${colorKeys})-(\\d{2,3})\\b`, 'g')
  },
  3: {
    desc: 'hover:*, focus:*, active:* (incluye cualquiera)',
    regex: new RegExp(`\\b(hover|focus|focus-visible|active|group-hover):([a-z]+)-(${colorKeys})-(\\d{2,3})\\b`, 'g')
  }
}

// Parsed Args
const args = process.argv.slice(2)
const isDryOption = args.includes('--dry') || args.includes('-d')
const batchArg = args.find(a => a.startsWith('--batch='))
if (!batchArg) {
  console.error("Uso: npx tsx scripts/migrate-tokens.ts --batch=1|2|3 [--dry]")
  process.exit(1)
}
const batchNum = parseInt(batchArg.split('=')[1], 10) as 1 | 2 | 3
if (![1, 2, 3].includes(batchNum)) {
  console.error("Batch inválido. Usa 1, 2 o 3.")
  process.exit(1)
}

const isDry = isDryOption

console.log(`\n=== MIGRACIÓN DE TOKENS - BATCH ${batchNum} ===`)
console.log(`Objetivo: ${BATCHES[batchNum].desc}`)
console.log(`Modo: ${isDry ? 'DRY-RUN (Simulación)' : 'EJECUCIÓN REAL'}\n`)

let totalReplacements = 0
let filesModified = 0

function walkDir(dir: string, callback: (filePath: string) => void) {
  if (!fs.existsSync(dir)) return
  for (const f of fs.readdirSync(dir)) {
    const dirPath = join(dir, f)
    const isDir = fs.statSync(dirPath).isDirectory()
    if (isDir) {
      walkDir(dirPath, callback)
    } else {
      if (dirPath.endsWith('.ts') || dirPath.endsWith('.tsx')) {
        let skip = false
        for (const pattern of IGNORE_PATTERNS) {
          if (pattern.test(dirPath)) skip = true
        }
        if (!skip) callback(dirPath)
      }
    }
  }
}

function processFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf-8')
  const original = content
  const regex = BATCHES[batchNum].regex
  let localReplacements = 0

  if (batchNum === 3) {
    // Regex group structure: 1=pseudo, 2=prop(bg/text/border/ring), 3=color, 4=scale
    content = content.replace(regex, (match, pseudo, prop, colorName, scale) => {
      const newLine = `${pseudo}:${prop}-${COLOR_MAP[colorName]}-${scale}`
      console.log(`  [Modificando] '${match}' -> '${newLine}'`)
      localReplacements++
      return newLine
    })
  } else {
    // Regex group structure: 1=prop(bg/text/border/ring), 2=color, 3=scale
    content = content.replace(regex, (match, prop, colorName, scale) => {
      const newLine = `${prop}-${COLOR_MAP[colorName]}-${scale}`
      console.log(`  [Modificando] '${match}' -> '${newLine}'`)
      localReplacements++
      return newLine
    })
  }

  if (localReplacements > 0) {
    console.log(`[FILE] ${filePath} (${localReplacements} reemplazos)`)
    totalReplacements += localReplacements
    filesModified++
    if (!isDry) {
      fs.writeFileSync(filePath, content, 'utf-8')
    }
  }
}

for (const p of DIRS_TO_SCAN) {
  walkDir(path.resolve(process.cwd(), p), processFile)
}

console.log(`\n=== RESUMEN ===`)
console.log(`Archivos tocados: ${filesModified}`)
console.log(`Reemplazos totales: ${totalReplacements}`)
if (isDry) {
  console.log(`(Este fue un Dry Run. Pasa el comando sin '--dry' para aplicar cambios.)`)
} else {
  console.log(`¡Cambios guardados con éxito! Por favor corre 'npm run lint' y tests.`)
}
