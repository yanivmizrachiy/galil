// Reader contract gate (SOURCE_OF_TRUTH.md §19): the public index.html reader must open directly in a
// continuous scroll of every student page, expose exactly one action ("הורדת PDF") that downloads a static
// same-origin PDF (no client-side generation, no preload), keep a sticky non-button page counter, and use a
// gentle scroll-snap. Print/PDF stay internal to QA (browser-qa.mjs), never surfaced here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';

const root = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pages = fs.readdirSync(root).filter(n=>/^page-\d+\.html$/.test(n)).map(n=>Number(n.match(/\d+/)[0]));
const total = pages.length;

const fail = [];
const ok = (cond, msg) => { if(!cond) fail.push(msg); };

// 1. Exactly one visible action — no other buttons or removed navigation controls.
ok(!/<button[\s>]/i.test(html), 'reader must expose no <button>; the only action is the PDF download link');
for(const f of ['singleMode','continuousMode','id="prev"','id="next"','id="page"','כל החוברות','פתח דף','דף בודד'])
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

// 4. Sticky, non-button page counter.
const counter = html.match(/<(\w+)\b([^>]*)\bid="counter"([^>]*)>/i);
ok(Boolean(counter), 'reader must have a page counter (id="counter")');
if(counter){
  ok(!/^(?:button|a|input)$/i.test(counter[1]), `page counter must not be a button/link/input (is <${counter[1]}>)`);
  ok(!/onclick=|href=/i.test(counter[2]+counter[3]), 'page counter must not be interactive (no onclick/href)');
}
ok(/position:sticky/.test(html), 'the top bar/counter must be sticky');

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

if(fail.length){
  console.error(`READER QA FAILED (${fail.length})`);
  fail.forEach((f,i)=>console.error(`${i+1}. ${f}`));
  process.exit(1);
}
console.log(`READER QA PASS: public reader opens as a continuous ${total}-page scroll with one action ("הורדת PDF" → static same-origin ${total}-page A4 PDF, download attr, no client-side generation/preload), a sticky non-button page counter, gentle scroll-snap proximity, and no print/prev/next/single-page/all-workbooks controls.`);
