// Reader contract gate (SOURCE_OF_TRUTH.md §19): the public index.html reader must open directly in a
// continuous scroll of every student page, expose exactly one action ("הורדת PDF") that downloads a static
// same-origin PDF (no client-side generation, no preload), keep a sticky non-button page counter, and use a
// gentle scroll-snap. Print/PDF stay internal to QA (browser-qa.mjs), never surfaced here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { MANIFEST, sourceDigest, pdfDigest } from './scripts/pdf-fingerprint.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pages = fs.readdirSync(root).filter(n=>/^page-\d+\.html$/.test(n)).map(n=>Number(n.match(/\d+/)[0]));
const total = pages.length;

const fail = [];
const ok = (cond, msg) => { if(!cond) fail.push(msg); };

// 1. Exactly one visible action — no other buttons or removed navigation controls.
ok(!/<button[\s>]/i.test(html), 'reader must expose no <button>; the only action is the PDF download link');
for(const f of ['singleMode','continuousMode','id="prev"','id="next"','id="page"','כל החוברות','פתח דף','דף בודד','הקודם','הבא</','גלילה רציפה</','הדפסה'])
  ok(!html.includes(f), `reader must not contain the removed control "${f}"`);
ok(!/window\.print\s*\(/.test(html), 'reader must not trigger print (print/PDF are kept for QA only)');
ok(!/\b(jspdf|html2pdf|html2canvas|pdf-lib|pdfmake)\b/i.test(html), 'reader must not generate a PDF client-side');

// 2. The single action: a static same-origin .pdf link with the download attribute.
const a = html.match(/<a\b[^>]*\bid="download"[^>]*>([\s\S]*?)<\/a>/i);
ok(Boolean(a), 'reader must have the download link (id="download")');
if(a){
  const tag = a[0];
  ok(/\sdownload[=\s>]/.test(tag), 'download link must carry the download attribute');
  const href = (tag.match(/href="([^"]+)"/) || [])[1] || '';
  ok(/\.pdf$/i.test(href), `download href must be a static .pdf (got "${href}")`);
  ok(!/^https?:|^\/\//i.test(href), `download href must be same-origin/relative (got "${href}")`);
  ok(href && fs.existsSync(path.join(root, href)), `download target "${href}" must exist in the repo`);
  ok(a[1].replace(/<[^>]*>/g,'').includes('הורדת PDF'), 'the single action must read "הורדת PDF"');
  ok(!/onclick=/i.test(tag), 'download must be a plain link (no onclick handler)');
}

// 3. No preload/prefetch of the PDF that would slow the reader's open.
ok(!/rel="(?:preload|prefetch)"[^>]*\.pdf|\.pdf[^>]*rel="(?:preload|prefetch)"/i.test(html),
   'reader must not preload/prefetch the PDF (download starts only on click)');

// 4. Sticky compact page selector (§19): a <select> showing "עמוד X מתוך N" — not a button — whose change
//    jumps straight to the page with a short fade (no smooth scroll through every page).
const counter = html.match(/<(\w+)\b([^>]*)\bid="counter"([^>]*)>/i);
ok(Boolean(counter), 'reader must have the page selector (id="counter")');
if(counter){
  ok(/^select$/i.test(counter[1]), `page selector must be a <select> (is <${counter[1]}>)`);
  ok(!/onclick=|href=/i.test(counter[2]+counter[3]), 'page selector must not carry onclick/href');
}
ok(/o\.textContent\s*=\s*`עמוד \$\{n\} מתוך \$\{total\}`/.test(html), 'selector options must read "עמוד X מתוך N"');
ok(/counter\.addEventListener\('change'/.test(html), 'selecting a page must trigger the jump (change handler)');
ok(/scrollIntoView\(\{[^}]*behavior:\s*'instant'/.test(html), 'page jump must scroll instantly (behavior:\'instant\'), not smooth-scroll through all pages');
ok(!/scrollIntoView\(\{[^}]*behavior:\s*'smooth'/.test(html), 'page jump must not use behavior:\'smooth\'');
const fadeMs = Number((html.match(/#reader\{transition:opacity\s*(\d+)ms/)||[])[1]);
ok(fadeMs>=150 && fadeMs<=220, `page jump fade must be a short 150–220ms opacity transition on #reader (got ${fadeMs||'none'})`);
ok(/#reader\.fading\{opacity:0\}/.test(html) && /classList\.add\('fading'\)/.test(html) && /classList\.remove\('fading'\)/.test(html), 'page jump must fade out (#reader.fading) → jump → fade in');
ok(/IntersectionObserver/.test(html) && /setCounter\(Number\(visible\.target\.dataset\.page\)\)/.test(html), 'selector must follow manual scrolling (IntersectionObserver → setCounter)');
const barRule = (html.match(/\.bar\s*\{[^}]*\}/) || [])[0] || '';
ok(/position:\s*sticky/.test(barRule), 'the .bar (holding the selector) must be position:sticky');

// 5. Gentle scroll-snap + continuous build of every page.
ok(/scroll-snap-type:\s*y\s+proximity/.test(html), 'reader must use gentle scroll-snap (y proximity)');
ok(/scroll-snap-align/.test(html), 'each page card must declare scroll-snap-align');
ok(/for\s*\(\s*let\s+n\s*=\s*1\s*;\s*n\s*<=\s*total/.test(html), 'reader must build all pages 1..total continuously');

// 6. The static PDF asset is present, A4, and current (one page per student page).
const pdfPath = path.join(root, 'galil-student.pdf');
if(fs.existsSync(pdfPath)){
  const doc = await PDFDocument.load(fs.readFileSync(pdfPath));
  ok(doc.getPageCount()===total, `static PDF has ${doc.getPageCount()} pages but there are ${total} student pages (rebuild: node scripts/build-pdf.mjs)`);
  for(const [i,p] of doc.getPages().entries()){
    const { width, height } = p.getSize();
    ok(Math.abs(width-595.28)<1.5 && Math.abs(height-841.89)<1.5, `static PDF page ${i+1} is not A4 (${width}x${height})`);
  }
}else ok(false, 'static PDF galil-student.pdf is missing (run: node scripts/build-pdf.mjs)');

// 7. Deterministic staleness gate: the committed PDF must have been built from the CURRENT pages.
//    scripts/build-pdf.mjs writes a manifest with the sha256 fingerprint of every rendering input
//    (page-*.html, styles.css, vendor/) and of the PDF itself; both are recomputed here, so any edit
//    to a page without rebuilding — or any PDF swapped in by hand — fails the gate. No print exposure.
const manifestPath = path.join(root, MANIFEST);
if(fs.existsSync(manifestPath) && fs.existsSync(pdfPath)){
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const current = sourceDigest(root);
  const changed = Object.keys({...current.files, ...(manifest.inputs||{})})
    .filter(f => current.files[f] !== (manifest.inputs||{})[f]);
  ok(manifest.sourceDigest === current.digest,
     `static PDF is STALE: rendering inputs changed since galil-student.pdf was built (${changed.slice(0,8).join(', ')}${changed.length>8?', …':''}) — run: node scripts/build-pdf.mjs and commit the PDF + manifest`);
  ok(manifest.pdfSha256 === pdfDigest(pdfPath),
     'galil-student.pdf does not match the manifest it was built with — run: node scripts/build-pdf.mjs and commit both');
  ok(manifest.pageCount === total, `manifest pageCount ${manifest.pageCount} != ${total} student pages`);
}else ok(false, `${MANIFEST} is missing — run: node scripts/build-pdf.mjs and commit the PDF + manifest`);

// 8. Intro illustration video (§19, Yaniv 2026-10-11): sits above the pages, credits Ayelet Krispin,
//    loads only on click via youtube-nocookie, and is hidden in print (the PDF stays worksheets-only).
const introIdx = html.indexOf('class="intro-video"');
ok(introIdx !== -1, 'reader must contain the intro illustration video block (.intro-video)');
ok(introIdx !== -1 && introIdx < html.indexOf('id="reader"'), 'the intro video must sit above the student pages (before #reader)');
ok(/data-id="l4vvuHCY1QI"/.test(html), 'intro video must reference the Galil illustration video (l4vvuHCY1QI)');
ok(/youtube-nocookie\.com\/embed\//.test(html), 'intro video must embed via youtube-nocookie');
ok(!/<iframe[^>]*youtube/i.test(html) && /facade\.replaceWith\(/.test(html), 'intro video must be click-to-load (iframe created on click, not hardcoded)');
ok(/איילת קריספין · מתכללת תחום המתמטיקה במחוז ירושלים והעיר ירושלים/.test(html), 'intro video must credit Ayelet Krispin with her role');
ok(/\.intro-video\{display:none\}/.test(html), 'intro video must be hidden in print');

if(fail.length){
  console.error(`READER QA FAILED (${fail.length})`);
  fail.forEach((f,i)=>console.error(`${i+1}. ${f}`));
  process.exit(1);
}
console.log(`READER QA PASS: public reader opens as a continuous ${total}-page scroll with one action ("הורדת PDF" → static same-origin ${total}-page A4 PDF, download attr, no client-side generation/preload), a sticky compact page selector (select, not a button) with an instant fade-jump, gentle scroll-snap proximity, and no print/prev/next/single-page/all-workbooks controls.`);
