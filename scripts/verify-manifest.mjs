// Fail-closed gate for WORKBOOK_MANIFEST.json (SOURCE_OF_TRUTH.md §19 reader contract +
// the district single-source rule). It proves the manifest the district reader consumes is
// in lockstep with the real pages and the committed PDF:
//   - exactly 49 content pages, each file present, workbookNumber contiguous 1..49;
//   - chapters cover 1..49 with no gap or overlap;
//   - pdf.sha256 == galil-student.pdf.manifest.json.pdfSha256 (the HTML↔PDF tie);
//   - contentHash == that manifest's sourceDigest (the version fingerprint);
//   - regenerating the manifest yields byte-identical output (no hand edits / no drift).
// Any mismatch exits non-zero so CI blocks publishing an HTML version against a stale PDF.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fail = (m) => { console.error('verify-manifest: ' + m); process.exitCode = 1; };

const manifest = JSON.parse(readFileSync(join(ROOT, 'WORKBOOK_MANIFEST.json'), 'utf8'));
const pdfManifest = JSON.parse(readFileSync(join(ROOT, 'galil-student.pdf.manifest.json'), 'utf8'));

if (manifest.schemaVersion !== 3) fail(`schemaVersion ${manifest.schemaVersion} != 3`);
if (manifest.totalPages !== 49) fail(`totalPages ${manifest.totalPages} != 49`);
if (manifest.pages.length !== 49) fail(`pages.length ${manifest.pages.length} != 49`);

manifest.pages.forEach((p, i) => {
  if (p.workbookNumber !== i + 1) fail(`page ${i}: workbookNumber ${p.workbookNumber} != ${i + 1}`);
  if (!existsSync(join(ROOT, p.file))) fail(`page file missing: ${p.file}`);
});

// chapters cover 1..49 contiguously
let next = 1;
for (const c of manifest.chapters) {
  if (c.startPage !== next) fail(`chapter ${c.id} starts at ${c.startPage}, expected ${next}`);
  if (c.endPage < c.startPage) fail(`chapter ${c.id} end < start`);
  next = c.endPage + 1;
}
if (next !== 50) fail(`chapters end at ${next - 1}, expected 49`);

if (manifest.cover?.file !== 'cover.html' || !existsSync(join(ROOT, 'cover.html'))) fail('cover.html missing/misdeclared');
if (manifest.assets?.fontsCss && !existsSync(join(ROOT, manifest.assets.fontsCss))) fail(`fontsCss missing: ${manifest.assets.fontsCss}`);
for (const css of manifest.assets?.css || []) if (!existsSync(join(ROOT, css))) fail(`css missing: ${css}`);

if (manifest.pdf?.sha256 !== pdfManifest.pdfSha256) fail('pdf.sha256 != galil-student.pdf.manifest.json.pdfSha256 (HTML/PDF version mismatch)');
if (manifest.pdf?.pageCount !== pdfManifest.pageCount) fail(`pdf.pageCount ${manifest.pdf?.pageCount} != ${pdfManifest.pageCount}`);
if (manifest.contentHash !== pdfManifest.sourceDigest) fail('contentHash != sourceDigest (stale version fingerprint)');

// Byte-identical regeneration: the manifest is derived, never hand-edited.
const current = readFileSync(join(ROOT, 'WORKBOOK_MANIFEST.json'), 'utf8');
execFileSync(process.execPath, [join(ROOT, 'scripts', 'build-workbook-manifest.mjs')], { cwd: ROOT, stdio: 'ignore' });
const regenerated = readFileSync(join(ROOT, 'WORKBOOK_MANIFEST.json'), 'utf8');
if (current !== regenerated) fail('WORKBOOK_MANIFEST.json is not in sync with its generator — run node scripts/build-workbook-manifest.mjs');

if (!process.exitCode) console.log('verify-manifest: OK — 49 pages, 6 chapters, PDF/content hashes in lockstep.');
