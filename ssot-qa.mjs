import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const SSOT = 'SOURCE_OF_TRUTH.md';
const fail = (msg) => { throw new Error(`SSOT QA failed: ${msg}`); };

const ssotPath = path.join(root, SSOT);
if (!fs.existsSync(ssotPath)) fail(`${SSOT} is missing`);
const ssot = fs.readFileSync(ssotPath, 'utf8');
if (!ssot.startsWith('# מקור האמת היחיד — גליל חדש')) fail('canonical SSOT title is missing or wrong');
if (!ssot.includes('זהו קובץ ההוראות והדרישות המחייב היחיד')) fail('SSOT does not declare itself as the only requirements authority');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  if (['.git','node_modules','exports'].includes(entry.name)) return [];
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});

const markdown = walk(root).filter((p) => /\.md$/i.test(p));
for (const file of markdown) {
  const rel = path.relative(root, file).replaceAll('\\','/');
  if (rel === SSOT) continue;
  const text = fs.readFileSync(file, 'utf8');
  if (/^#\s+מקור האמת היחיד\b/m.test(text)) fail(`${rel} declares a competing source of truth`);
  if (/זהו קובץ ההוראות והדרישות המחייב היחיד/.test(text)) fail(`${rel} declares competing requirements authority`);
  if (/\bSSOT:ONLY-AUTHORITY\b/.test(text)) fail(`${rel} contains the authority marker reserved for ${SSOT}`);
}

console.log('SSOT QA: PASS — SOURCE_OF_TRUTH.md is the single requirements authority for גליל חדש');
