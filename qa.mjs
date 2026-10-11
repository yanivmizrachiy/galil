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
assert(/print-color-adjust:\s*exact/.test(css), 'print-color-adjust:exact is required so the work-grid ruling and shaded fills survive the default browser Save-as-PDF (background graphics off) — SOURCE_OF_TRUTH.md §16/§4');
assert(css.includes('יניב רז - מדריך מחוזי חט\\"ב בעיר ירושלים'), 'canonical first credit line is missing');
assert(css.includes('הדרכה במחוז ירושלים והעיר ירושלים - מנח\\"י, בהובלת איילת קריספין'), 'canonical second credit line is missing');
assert(/white-space:pre-line/.test(css), 'credit footer must render as two lines');
assert(/\.a4-page::after\{[^}]*right:0;left:0;[^}]*border-top:\s*2px solid #1e3a8a/.test(css), 'district footer must have a full-width blue rule above the footer text');

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
  if (page === 1) {
    // SOURCE_OF_TRUTH.md §17: page 1 opens with the big title „גליל” and the smaller subtitle „מושגים בסיסיים”.
    assert(/<div class="page-titles"><h1 class="page-title">גליל<\/h1><p class="page-subtitle">מושגים בסיסיים<\/p><\/div>/.test(html), 'page 1: header must be h1 „גליל” with subtitle „מושגים בסיסיים” inside .page-titles');
    assert(!/<h1[^>]*>מושגים בסיסיים<\/h1>/.test(html), 'page 1: „מושגים בסיסיים” must be the subtitle, not the h1');
  }
  if (page < 19) assert(!/V\s*=/.test(html), `page ${page}: volume formula is forbidden before page 19`);

  // Surface-area work is no longer forbidden here. SOURCE_OF_TRUTH.md now explicitly
  // requires separate base-area, lateral-area and total-surface-area student pages.
  // Their implementation/completeness gates will be added only after Yaniv finishes
  // the still-open specification; this legacy integrity QA must not contradict it.

  if (page === 20) {
    assert(/<th>נפח לפני<\/th><th>נפח אחרי<\/th>[\s\S]*____ סמ״ק<\/td><td>____ סמ״ק/.test(html), 'page 20: before/after volume answers must carry cubic-centimeter units');
  }

  if (page === 43) {
    // SOURCE_OF_TRUTH.md §13: the axial-section rectangle (width 2r) has diagonal √((2r)²+h²);
    // √(r²+h²) belongs to the half-section triangle (legs r,h) and must never be called the rectangle diagonal.
    assert(/אלכסון המלבן[^<]*<span dir="ltr">= √\(\(2r\)² \+ h²\)<\/span>/.test(html), 'page 43: rectangle diagonal must be taught as √((2r)² + h²)');
    assert(/חצי־חתך<\/b>[\s\S]*ניצביו <span dir="ltr">r<\/span> ו־<span dir="ltr">h<\/span>[\s\S]*√\(r² \+ h²\)/.test(html), 'page 43: √(r² + h²) must be attributed to the half-section triangle (legs r, h)');
    assert(/ואינו אלכסון המלבן/.test(html), 'page 43: the half-section segment must be explicitly distinguished from the rectangle diagonal');
    assert(!/כשהבסיס הוא הרדיוס, ל־|הבסיס הוא הרדיוס/.test(html), 'page 43: √(r² + h²) must not be presented as the rectangle diagonal "when the base is the radius"');
    assert(count(html, /x1="115" y1="155" x2="190" y2="25"/g) === 1 && count(html, /x1="40" y1="155" x2="190" y2="25"/g) === 1, 'page 43: figure must draw both the rectangle diagonal and the half-section segment');
    assert(count(html, /אלכסון המלבן\.<\/p>/g) === 2 && count(html, /חצי־חתך\.<\/p>/g) === 2, 'page 43: every exercise must state which segment is computed');
  }
  if (page === 38) {
    assert(/r=4<\/span> ס״מ, <span dir="ltr">h=5<\/span> ס״מ/.test(html), 'page 38: direct-volume data must include length units');
    assert(/d=10<\/span> ס״מ, <span dir="ltr">h=3<\/span> ס״מ[\s\S]*r=____<\/span> ס״מ, <span dir="rtl">נפח=____π<\/span> סמ״ק/.test(html), 'page 38: diameter-to-volume item must preserve radius and volume units');
    assert(/20π<\/span> סמ״ק ___ <span dir="ltr">62\.83<\/span> סמ״ק/.test(html), 'page 38: approximation comparison must carry equal volume units on both sides');
    assert(/שטח הבסיס=16π<\/span> סמ״ר, <span dir="rtl">נפח=80π<\/span> סמ״ק[\s\S]*h=____<\/span> ס״מ/.test(html), 'page 38: reverse-height item must preserve area, volume, and height units');
    assert(/נפח=147π<\/span> סמ״ק, <span dir="ltr">h=3<\/span> ס״מ[\s\S]*r=____<\/span> ס״מ/.test(html), 'page 38: reverse-radius item must preserve volume, height, and radius units');
  }
}

console.log(`Cylinder QA: PASS (${pages.length} current student pages checked; page count remains open per SOURCE_OF_TRUTH.md; math-notation/unit guards active; intentional page-11 error-detection exception locked; no separate answer keys; surface-area requirements are no longer blocked by legacy QA)`);
