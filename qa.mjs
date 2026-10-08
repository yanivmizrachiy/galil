import './ssot-qa.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(`Cylinder QA failed: ${message}`); };
const count = (text, pattern) => (text.match(pattern) || []).length;

assert(/width:210mm/.test(css) && /height:297mm/.test(css), 'A4 dimensions must be exactly 210×297mm');
assert(/overflow:hidden/.test(css), 'A4 page must guard against overflow');
assert(/@page\{size:A4;margin:0\}/.test(css), 'print page contract is missing');
assert(css.includes('יניב רז - מדריך מחוזי חט\\"ב בעיר ירושלים'), 'canonical first credit line is missing');
assert(css.includes('הדרכה במחוז ירושלים והעיר ירושלים - מנח\\"י, בהובלת איילת קריספין'), 'canonical second credit line is missing');
assert(/white-space:pre-line/.test(css), 'credit footer must render as two lines');

const answerFiles = fs.readdirSync(dir).filter(name => /\.answers\.json$/i.test(name));
assert(answerFiles.length === 0, `separate answer-key files are forbidden: ${answerFiles.join(', ')}`);

const pages = fs.readdirSync(dir)
  .filter(name => /^page-\d+\.html$/.test(name))
  .map(name => Number(name.match(/\d+/)[0]))
  .sort((a,b) => a-b);

// The historical workbook currently has 38 pages, but SOURCE_OF_TRUTH.md explicitly
// says 38 is not a target. QA therefore protects structural integrity without freezing
// the new Galil workbook to the legacy page count while the specification is still open.
assert(pages.length > 0, 'at least one student page must exist');
assert(new Set(pages).size === pages.length, 'page numbers must be unique');
pages.forEach((page, index) => assert(page === index + 1, `student sequence must be continuous from 1; found page ${page} at position ${index + 1}`));

// index.html navigation must always match the real number of student pages (SOURCE_OF_TRUTH.md §19).
const indexHtml = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const indexTotal = Number((indexHtml.match(/const total\s*=\s*(\d+)/) || [])[1]);
assert(indexTotal === pages.length, `index.html total (${indexTotal}) must equal the number of student pages (${pages.length})`);

for (const page of pages) {
  const html = fs.readFileSync(path.join(dir, `page-${page}.html`), 'utf8')
    .replace(/\\[()]/g, '').replace(/\\pi\b/g, 'π').replace(/\\approx/g, '≈');
  assert(/<html[^>]*lang="he"[^>]*dir="rtl"/.test(html), `page ${page}: Hebrew RTL root is required`);
  assert(count(html, /<h1\b/g) === 1, `page ${page}: exactly one visible page heading is required`);
  assert(count(html, /<h[23]\b/g) === 0, `page ${page}: question-level headings are forbidden`);
  assert(new RegExp(`aria-label="עמוד ${page}"[^>]*>${page}<\\/div>`).test(html), `page ${page}: visible page number mismatch`);
  // The canonical district footer is rendered by styles.css (.a4-page::after, asserted above);
  // the legacy name/date <footer> was removed in fe9d26d, so pages must only link the shared stylesheet.
  assert(/<link rel="stylesheet" href="styles.css">/.test(html), `page ${page}: shared styles.css (canonical district footer) is required`);
  assert(!/[×]/.test(html), `page ${page}: multiplication sign × is forbidden`);
  assert(!/\d\s*[xX]\s*\d/.test(html), `page ${page}: x/X must not be used as a numeric multiplication sign`);
  if (page === 11) {
    assert(count(html, /π\s*=\s*3(?:[.,])14/g) === 1, 'page 11: the intentionally incorrect π = 3.14 statement must appear exactly once');
    assert(/סמנו בכל שורה: תקין \/ לא תקין/.test(html), 'page 11: exact-equality distractor must be inside the closed תקין/לא תקין task');
    assert(/π הוא מספר מדויק[\s\S]*π ≈ 3\.14[\s\S]*ולא שוויון/.test(html), 'page 11: anchor must explicitly teach π ≈ 3.14 and reject exact equality');
  } else {
    assert(!/π\s*=\s*3(?:[.,])14/.test(html), `page ${page}: π must never be written as exactly 3.14 outside the page-11 error-detection task`);
  }
  assert(!/demo|placeholder/i.test(html), `page ${page}: demo/placeholder text is forbidden`);
  // SOURCE_OF_TRUTH.md §6: official curriculum questions keep their wording 1:1, so pages marked
  // data-official="curriculum" are exempt from the open-response wording guard.
  const official = /data-official="curriculum"/.test(html);
  if (!official) assert(!/נמקו|הסבירו\s+במילים/.test(html), `page ${page}: unrestricted open response wording is forbidden`);
  if (page === 1) assert(/<h1[^>]*>מושגים בסיסיים<\/h1>/.test(html), 'page 1: canonical opening title must be מושגים בסיסיים');
  if (page < 19) assert(!/V\s*=/.test(html), `page ${page}: volume formula is forbidden before page 19`);

  // Surface-area work is no longer forbidden here. SOURCE_OF_TRUTH.md now explicitly
  // requires separate base-area, lateral-area and total-surface-area student pages.
  // Their implementation/completeness gates will be added only after Yaniv finishes
  // the still-open specification; this legacy integrity QA must not contradict it.

  if (page === 20) {
    assert(/<th>V לפני<\/th><th>V אחרי<\/th>[\s\S]*____ ס״מ³<\/td><td>____ ס״מ³/.test(html), 'page 20: before/after volume answers must carry cubic-centimeter units');
  }

  if (page === 38) {
    assert(/r=4<\/span> ס״מ, <span dir="ltr">h=5<\/span> ס״מ/.test(html), 'page 38: direct-volume data must include length units');
    assert(/d=10<\/span> ס״מ, <span dir="ltr">h=3<\/span> ס״מ[\s\S]*r=____<\/span> ס״מ, <span dir="ltr">V=____π<\/span> ס״מ³/.test(html), 'page 38: diameter-to-volume item must preserve radius and volume units');
    assert(/20π<\/span> ס״מ³ ___ <span dir="ltr">62\.83<\/span> ס״מ³/.test(html), 'page 38: approximation comparison must carry equal volume units on both sides');
    assert(/B=16π<\/span> ס״מ², <span dir="ltr">V=80π<\/span> ס״מ³[\s\S]*h=____<\/span> ס״מ/.test(html), 'page 38: reverse-height item must preserve area, volume, and height units');
    assert(/V=147π<\/span> ס״מ³, <span dir="ltr">h=3<\/span> ס״מ[\s\S]*r=____<\/span> ס״מ/.test(html), 'page 38: reverse-radius item must preserve volume, height, and radius units');
  }
}

console.log(`Cylinder QA: PASS (${pages.length} current student pages checked; page count remains open per SOURCE_OF_TRUTH.md; math-notation/unit guards active; intentional page-11 error-detection exception locked; no separate answer keys; surface-area requirements are no longer blocked by legacy QA)`);
