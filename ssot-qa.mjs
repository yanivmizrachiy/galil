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

// 2026-10-09 (Yaniv): make sure the repository has exactly one source of truth.
// Competing requirement documents, JSON files pointing elsewhere, and navigation docs that
// do not point back to SOURCE_OF_TRUTH.md all fail this gate.
const competingNames = /^(RULES|SPEC|SPECIFICATION|REQUIREMENTS|SSOT|TRUTH|SOURCE_OF_TRUTH[-_.].+)\.md$/i;
for (const file of walk(root)) {
  const rel = path.relative(root, file).replaceAll('\\','/');
  if (rel === SSOT || rel.startsWith('vendor/') || rel.startsWith('.git/')) continue;
  if (competingNames.test(path.basename(file))) fail(`${rel} looks like a competing requirements document; merge it into ${SSOT}`);
  if (/\.json$/i.test(file)) {
    const text = fs.readFileSync(file, 'utf8');
    if (/מקור האמת היחיד|SSOT:ONLY-AUTHORITY/.test(text)) fail(`${rel} declares a competing source of truth`);
    let data = null;
    try { data = JSON.parse(text); } catch { data = null; }
    if (data && typeof data === 'object' && 'canonicalSourceOfTruth' in data && data.canonicalSourceOfTruth !== SSOT) fail(`${rel} points to a different source of truth: ${data.canonicalSourceOfTruth}`);
  }
}
for (const doc of ['README.md', 'CLAUDE.md', 'SOURCES.md', 'PROVENANCE.md']) {
  const docPath = path.join(root, doc);
  if (fs.existsSync(docPath) && !fs.readFileSync(docPath, 'utf8').includes(SSOT)) fail(`${doc} must point back to ${SSOT}`);
}

console.log('SSOT QA: PASS — SOURCE_OF_TRUTH.md is the single requirements authority for גליל חדש');
