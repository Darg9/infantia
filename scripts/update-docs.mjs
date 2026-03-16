import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const ARCH_FILE = path.join(ROOT_DIR, 'ARCHITECTURE.md');

function getDirectories(srcpath) {
  if (!fs.existsSync(srcpath)) return [];
  return fs.readdirSync(srcpath).filter(file => fs.statSync(path.join(srcpath, file)).isDirectory());
}

function getFiles(srcpath) {
  if (!fs.existsSync(srcpath)) return [];
  return fs.readdirSync(srcpath).filter(file => !fs.statSync(path.join(srcpath, file)).isDirectory());
}

function generateApiList() {
  const apiBase = path.join(ROOT_DIR, 'src', 'app', 'api');
  const dirs = getDirectories(apiBase);
  let list = '';
  
  // Recursively find routes
  function walk(dir, prefix = '/api') {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath, `${prefix}/${item}`);
      } else if (item === 'route.ts' || item === 'route.js') {
        list += `- \`${prefix}\`\n`;
      }
    }
  }
  
  if (fs.existsSync(apiBase)) {
    walk(apiBase);
  }
  
  return list || '- No hay APIs documentadas aún.';
}

function generateModuleList() {
  const moduleBase = path.join(ROOT_DIR, 'src', 'modules');
  const dirs = getDirectories(moduleBase);
  let list = '';
  
  for (const dir of dirs) {
    const indexPath = path.join(moduleBase, dir, 'index.ts');
    const hasIndex = fs.existsSync(indexPath);
    list += `- **${dir}**: ${hasIndex ? 'Módulo lógico completo.' : 'Contenedor de componentes/utilidades.'}\n`;
  }
  
  return list || '- No hay módulos registrados.';
}

function updateFile() {
  if (!fs.existsSync(ARCH_FILE)) {
    console.error('ARCHITECTURE.md no encontrado.');
    return;
  }

  let content = fs.readFileSync(ARCH_FILE, 'utf8');

  // Update API
  const apiList = generateApiList();
  const apiRegex = /<!-- AUTO_GEN_API_START -->[\s\S]*<!-- AUTO_GEN_API_END -->/;
  content = content.replace(apiRegex, `<!-- AUTO_GEN_API_START -->\n${apiList}<!-- AUTO_GEN_API_END -->`);

  // Update Modules
  const moduleList = generateModuleList();
  const moduleRegex = /<!-- AUTO_GEN_MODULES_START -->[\s\S]*<!-- AUTO_GEN_MODULES_END -->/;
  content = content.replace(moduleRegex, `<!-- AUTO_GEN_MODULES_START -->\n${moduleList}<!-- AUTO_GEN_MODULES_END -->`);

  fs.writeFileSync(ARCH_FILE, content);
  console.log('✅ ARCHITECTURE.md actualizado con éxito.');
}

updateFile();
