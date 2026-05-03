const fs = require('fs');
const path = require('path');

const DIR = 'src';

// Regex para atrapar bg-, text-, border-, ring- seguidos de un color semántico prohibido
const SEMANTIC_RE = /((?:(?:hover|focus|active|md|sm|lg|xl|2xl):)?(?:dark:)?(?:hover:)?(?:focus:)?)(bg|text|border|ring)-(red|green|blue|yellow|emerald|indigo|orange)-(\d{2,3})/g;

const COLOR_MAP = {
  'green': 'success',
  'emerald': 'success',
  'red': 'error',
  'yellow': 'warning',
  'blue': 'info',
  'orange': 'brand',
  'indigo': 'brand'
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  content = content.replace(SEMANTIC_RE, (match, prefix, property, color, level) => {
    // If it's a prefix, clean it? The user's semantic variables might not be --hp-success, wait.
    // The user said: map to --hp-success. BUT wait, does the tailwind config have `success-500` or `var(--hp-success)`?
    // "Uso de color Tailwind directo prohibido. Usa tokens hp-* (ej: text-[var(--hp-text-primary)])"
    // Wait, the user said:
    // green / emerald -> --hp-success
    // red -> --hp-error
    // But then: are there `bg-[var(--hp-success)]`? Or `success-500`?
    // Let's map to `var(--hp-[color])`
    // Actually, usually it's `text-[var(--hp-success)]` or `text-success-500` if configured.
    // Let's check `tailwind.config.ts` if we can. Or we just map to `[var(--hp-COLOR)]`.
    // Let's just map to `property-[var(--hp-COLOR)]`.
    // Wait, let's use tailwind semantic colors `success-500` first, if the linter complains we fix it.
    // The user's prompt:
    // Mapear: green/emerald -> --hp-success
    // Let's output `property-[var(--hp-success)]` directly!
    // But what about the weight? (500, 600, etc).
    // `text-green-400` -> `text-[var(--hp-success)]`
    // `bg-red-50` -> `bg-[var(--hp-error-subtle)]`?
    // Since I don't know the exact token for weights, it might be safer to replace the color name: `bg-success-50`.
    // Let's check a file that had a semantic color correctly.
    // "bg-success-100 text-success-700" was used in `src/app/admin/sponsors/page.tsx` line 160.
    // So the system DOES use `success-100`, `success-700`!
    
    const mappedColor = COLOR_MAP[color] || color;
    return `${prefix}${property}-${mappedColor}-${level}`;
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
