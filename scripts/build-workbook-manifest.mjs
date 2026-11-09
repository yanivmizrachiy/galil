// Build WORKBOOK_MANIFEST.json (schemaVersion 3) — the canonical, machine-readable
// registry that the Jerusalem district site's shared native reader (jerusalem2
// NativeWorkbookReader) consumes to display this workbook's HTML pages directly from
// this repository's GitHub Pages origin, with no second copy of the content.
//
// Single source of truth: the manifest is DERIVED. `contentHash` and `pdf.sha256` are
// copied from galil-student.pdf.manifest.json (the existing staleness gate), so the
// district reader can prove the HTML pages and the downloadable PDF are the same version.
// Chapters/colours are the TOC model; nothing here changes page content (SOURCE_OF_TRUTH
// §3 keeps the spec closed) — it only exposes what already exists.
//
// Regenerate with: node scripts/build-workbook-manifest.mjs   (checked by scripts/verify-manifest.mjs)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pdfManifest = JSON.parse(readFileSync(join(ROOT, 'galil-student.pdf.manifest.json'), 'utf8'));

// The 49 content pages, in order. The cover is a separate leading sheet (not numbered),
// exactly as the workbook's own reader treats it ("עמוד n מתוך 49").
const pageFiles = readdirSync(ROOT)
  .filter((f) => /^page-\d+\.html$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
if (pageFiles.length !== 49) throw new Error(`expected 49 page-N.html, found ${pageFiles.length}`);

const titleOf = (file) => {
  const html = readFileSync(join(ROOT, file), 'utf8');
  const t = html.match(/<title>([^<]*)<\/title>/);
  return t ? t[1].trim() : '';
};

// Chapters = the pedagogical groups already present in the page titles (SOURCE_OF_TRUTH
// §9/§27). startPage/endPage are content page numbers (1–49). Colours are distinct, gentle
// TOC accents from the district palette; the A4 paper and its headings stay canonical.
const chapters = [
  { id: 'recognition', title: 'זיהוי הגליל ומושגי יסוד', startPage: 1, endPage: 10, color: '#2563eb', tint: '#eff6ff' },
  { id: 'base-area', title: 'π ושטח הבסיס', startPage: 11, endPage: 16, color: '#0f766e', tint: '#ecfdf5' },
  { id: 'volume', title: 'נפח הגליל', startPage: 17, endPage: 38, color: '#7c3aed', tint: '#f5f3ff' },
  { id: 'surface', title: 'שטח הפנים', startPage: 39, endPage: 41, color: '#c2410c', tint: '#fff7ed' },
  { id: 'prep', title: 'הכנה לשאלות התוכנית', startPage: 42, endPage: 43, color: '#15803d', tint: '#f0fdf4' },
  { id: 'curriculum', title: 'שאלות מתוך תוכנית הלימודים', startPage: 44, endPage: 49, color: '#a16207', tint: '#fefce8' },
];
const chapterOf = (n) => chapters.find((c) => n >= c.startPage && n <= c.endPage).id;

const pages = pageFiles.map((file, i) => ({
  file,
  workbookNumber: i + 1,
  chapterId: chapterOf(i + 1),
  title: titleOf(file),
}));

const manifest = {
  schemaVersion: 3,
  id: 'galil',
  name: 'חוברת הגליל',
  author: 'יניב רז',
  credit: [
    'יניב רז - מדריך מחוזי חט״ב בעיר ירושלים',
    'הדרכה במחוז ירושלים והעיר ירושלים - מנח״י, בהובלת איילת קריספין',
  ],
  totalPages: pages.length,
  cover: { file: 'cover.html', selector: '.a4-cover' },
  pageSelector: 'main.a4-page',
  assets: {
    // One global sheet (its html/body/@page rules are inert inside the reader's Shadow DOM).
    css: ['styles.css'],
    // Page-specific CSS lives inline in each page's <head><style> (pages 1, 11); the reader
    // preserves those. No separate per-page CSS files exist in this workbook.
    pageCssPattern: null,
    // Self-hosted Rubik/Heebo for the reader (reuses the cover's woff2 — not a PDF input,
    // so it never changes the staleness gate). The pages' own font stack resolves to these.
    fontsCss: 'styles/reader-fonts.css',
    // MathJax (pages 11–14) — the same local engine the pages declare.
    mathjax: 'vendor/mathjax/tex-mml-chtml.js',
    mathjaxFontRoot: 'vendor/mathjax/tex-font/chtml/woff2',
  },
  pages,
  chapters,
  pdf: {
    file: 'galil-student.pdf',
    pageCount: pdfManifest.pageCount, // 50 = cover + 49
    sha256: pdfManifest.pdfSha256,
    coverPages: 1, // content page k ↔ PDF page k+1
  },
  contentHash: pdfManifest.sourceDigest,
  builtAt: pdfManifest.builtAt,
  version: JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version || '0.0.0',
};

writeFileSync(join(ROOT, 'WORKBOOK_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`WORKBOOK_MANIFEST.json written: ${pages.length} pages, ${chapters.length} chapters, pdf ${manifest.pdf.pageCount}pp.`);
