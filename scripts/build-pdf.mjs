// Build the static public PDF for the Galil Reader (SOURCE_OF_TRUTH.md §19).
// Renders every student page as one A4 page into a single same-origin file, galil-student.pdf,
// which index.html links with `download` (no client-side PDF generation at click time).
// Usage: node scripts/build-pdf.mjs
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceDigest, pdfDigest, MANIFEST } from './pdf-fingerprint.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'galil-student.pdf');
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };

const pages = fs.readdirSync(root).filter(n=>/^page-\d+\.html$/.test(n))
  .map(n=>Number(n.match(/\d+/)[0])).sort((a,b)=>a-b);
if(!pages.length){ console.error('build-pdf: no student pages found'); process.exit(1); }

// Hard timeout so a stuck headless run can never hang CI or leak processes.
const hardTimeout = setTimeout(()=>{ console.error('build-pdf: hard timeout'); process.exit(1); }, 180000);

const server = http.createServer((req,res)=>{
  const pathname = new URL(req.url,'http://127.0.0.1').pathname;
  const rel = pathname==='/'?'index.html':pathname.replace(/^\//,'');
  const file = path.resolve(root, rel);
  if(!file.startsWith(root+path.sep)){ res.writeHead(403); res.end(); return; }
  fs.readFile(file,(err,buf)=>{
    if(err){ res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
    res.end(buf);
  });
});

let browser;
try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1200 } });
  const combined = await PDFDocument.create();

  // Yaniv 2026-10-11: approved unnumbered cover is PDF sheet 1; student pages remain numbered 1..49.
  await page.goto(`${base}cover.html`, { waitUntil:'load' });
  await page.evaluate(async()=>{
    await document.fonts.ready;
    const img=document.querySelector('.cover-image');
    if(img && !img.complete) await new Promise((resolve,reject)=>{
      img.addEventListener('load',resolve,{once:true});
      img.addEventListener('error',()=>reject(new Error('cover image failed to load')),{once:true});
    });
  });
  const coverAudit = await page.evaluate(()=>{
    const c=document.querySelector('.a4-cover'), img=document.querySelector('.cover-image');
    return {cover:!!c, image:!!img && img.complete && img.naturalWidth>0, numbered:!!document.querySelector('.page-number')};
  });
  if(!coverAudit.cover || !coverAudit.image || coverAudit.numbered) throw new Error(`cover contract failed: ${JSON.stringify(coverAudit)}`);
  const coverBytes = await page.pdf({ format:'A4', printBackground:true, preferCSSPageSize:true,
    margin:{ top:'0', right:'0', bottom:'0', left:'0' } });
  const coverDoc = await PDFDocument.load(coverBytes);
  if(coverDoc.getPageCount()!==1) throw new Error(`cover produced ${coverDoc.getPageCount()} PDF pages`);
  const [coverPage] = await combined.copyPages(coverDoc,[0]);
  combined.addPage(coverPage);
  for(const n of pages){
    await page.goto(`${base}page-${n}.html`, { waitUntil:'load' });
    // Print only after MathJax has typeset and fonts are ready, so the PDF never captures raw TeX.
    await page.evaluate(async()=>{ if(window.MathJax?.startup?.promise) await window.MathJax.startup.promise; await document.fonts.ready; });
    const raw = await page.evaluate(()=>/\\\(|\\\)/.test(document.querySelector('.a4-page')?.innerText||'') || document.querySelectorAll('mjx-merror').length>0);
    if(raw) throw new Error(`page ${n}: MathJax did not typeset cleanly; refusing to build a PDF with raw TeX`);
    await page.waitForTimeout(30);
    const bytes = await page.pdf({ format:'A4', printBackground:true, preferCSSPageSize:true,
      margin:{ top:'0', right:'0', bottom:'0', left:'0' } });
    const one = await PDFDocument.load(bytes);
    if(one.getPageCount()!==1) throw new Error(`page ${n}: produced ${one.getPageCount()} PDF pages`);
    const [copied] = await combined.copyPages(one,[0]);
    combined.addPage(copied);
  }
  if(combined.getPageCount()!==pages.length+1) throw new Error(`combined ${combined.getPageCount()} != ${pages.length+1} (cover + student pages)`);
  fs.writeFileSync(out, await combined.save());
  // Staleness manifest (SOURCE_OF_TRUTH.md §19): fingerprint of every rendering input + the produced PDF.
  // reader-qa.mjs recomputes both and fails when galil-student.pdf no longer matches the current pages.
  const src = sourceDigest(root);
  fs.writeFileSync(path.join(root, MANIFEST), JSON.stringify({
    schemaVersion: 1,
    purpose: 'Deterministic staleness gate for the static public PDF (SOURCE_OF_TRUTH.md §19). Derived file — regenerate with node scripts/build-pdf.mjs.',
    builtAt: new Date().toISOString(),
    pageCount: combined.getPageCount(),
    inputs: src.files,
    sourceDigest: src.digest,
    pdfSha256: pdfDigest(out)
  }, null, 2) + '\n');
  console.log(`build-pdf: wrote ${path.basename(out)} — ${combined.getPageCount()} A4 pages (${(fs.statSync(out).size/1024).toFixed(0)} KB)`);
}finally{
  if(browser) await browser.close();
  await new Promise(r=>server.close(r));
  clearTimeout(hardTimeout);
}
