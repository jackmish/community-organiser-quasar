const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORES = ['node_modules', '.git', 'dist', 'build', 'www', 'src-capacitor', 'src-electron', '.quasar'];
const EXTENSIONS = ['', '.ts', '.js', '.mjs', '.cjs', '.vue', '.tsx', '.jsx', '.json'];

function walk(dir, filelist = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (IGNORES.includes(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, filelist);
    else if (/\.(ts|js|mjs|cjs|vue|tsx|jsx)$/.test(ent.name)) filelist.push(full);
  }
  return filelist;
}

function readFile(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (e) { return ''; }
}

function extractSpecifiers(content) {
  const specs = new Set();
  const fromRegex = /from\s+['"]([^'"\\)]+)['"]/g;
  const importRegex = /import\s+['"]([^'"\\)]+)['"]/g;
  const requireRegex = /require\(\s*['"]([^'"\\)]+)['"]\s*\)/g;
  const dynamicRegex = /import\(\s*['"]([^'"\\)]+)['"]\s*\)/g;

  let m;
  while ((m = fromRegex.exec(content))) specs.add(m[1]);
  while ((m = importRegex.exec(content))) specs.add(m[1]);
  while ((m = requireRegex.exec(content))) specs.add(m[1]);
  while ((m = dynamicRegex.exec(content))) specs.add(m[1]);
  return Array.from(specs);
}

function resolveLocal(importer, spec) {
  // treat src/ as project src alias
  if (spec.startsWith('src/')) {
    const candidate = path.join(ROOT, spec);
    return tryExts(candidate);
  }

  if (spec.startsWith('.') || spec.startsWith('..') || spec.startsWith('/')) {
    const base = path.resolve(path.dirname(importer), spec);
    return tryExts(base);
  }

  // not local (likely package) -> return true
  return { found: true, resolved: spec, package: true };
}

function tryExts(base) {
  for (const ext of EXTENSIONS) {
    const p = base + ext;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return { found: true, resolved: p };
  }
  // try index files inside directory
  for (const ext of EXTENSIONS) {
    const p = path.join(base, 'index' + ext);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return { found: true, resolved: p };
  }
  return { found: false, resolved: base };
}

function isIgnoredFile(file) {
  return IGNORES.some(i => file.split(path.sep).includes(i));
}

function main() {
  console.log('Scanning project for import/require specifiers...');
  const files = walk(ROOT);
  console.log('Files scanned:', files.length);

  const missing = [];
  for (const f of files) {
    if (isIgnoredFile(f)) continue;
    const src = readFile(f);
    const specs = extractSpecifiers(src);
    if (!specs.length) continue;
    for (const s of specs) {
      const res = resolveLocal(f, s);
      if (!res.found) {
        missing.push({ importer: f, spec: s, tried: res.resolved });
      }
    }
  }

  if (missing.length === 0) {
    console.log('\nAll local import targets were found.');
    return process.exit(0);
  }

  console.log(`\nMissing imports detected: ${missing.length}`);
  for (const m of missing.slice(0, 200)) {
    console.log('- Importer:', path.relative(ROOT, m.importer));
    console.log('  Specifier:', m.spec);
    console.log('  Tried:', m.tried);
  }

  process.exit(2);
}

main();
