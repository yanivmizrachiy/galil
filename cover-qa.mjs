import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
const fail=[]; const ok=(c,m)=>{if(!c)fail.push(m)};
const cover=fs.readFileSync('cover.html','utf8');
const ssot=fs.readFileSync('SOURCE_OF_TRUTH.md','utf8');
const index=fs.readFileSync('index.html','utf8');
const disposition=JSON.parse(fs.readFileSync('page-disposition.json','utf8'));
const studentPages=fs.readdirSync('.').filter(n=>/^page-\d+\.html$/.test(n)).length;
// SSOT §19 "שער החוברת": the designed cover (Yaniv, 2026-10-12) — title, subtitle, tagline, inline SVG scene, no binary asset.
ok(/<h1[^>]*>גָּלִיל<\/h1>/.test(cover),'cover title must be גָּלִיל');
ok(cover.includes('חוברת עבודה במתמטיקה') && cover.includes('גֵּאוֹמֶטְרִיָּה בִּרְחוֹבוֹת יְרוּשָׁלַיִם'),'cover must keep the designed subtitle and tagline');
ok(/<figure class="scene">\s*<svg/.test(cover) && !/<img\b/.test(cover),'cover artwork is the inline SVG scene — no external or binary image');
ok(/class="cover a4-cover"/.test(cover) && /width:210mm;height:297mm/.test(cover),'cover must be one A4 sheet the reader can fit');
ok(!/page-number/.test(cover),'cover must be unnumbered');
ok(!fs.existsSync('assets/cover-bg.webp'),'the withdrawn placeholder artwork must not return');
ok(index.includes('class="cover-preview"') && index.indexOf('class="cover-preview"') < index.indexOf('class="intro-video"'),'public reader must show cover before video');
ok(ssot.includes('גָּלִיל') && ssot.includes('חוברת עבודה במתמטיקה') && ssot.includes('50 גיליונות'),'SSOT must state the canonical cover + 49-page PDF contract');
ok(disposition.pages?.length===49 && disposition.pages.every((x,i)=>x.page===i+1 && ['A','B','C','D'].includes(x.disposition)),'all 49 pages need a final A/B/C/D disposition');
const pdf=await PDFDocument.load(fs.readFileSync('galil-student.pdf'));
ok(studentPages===49,`expected 49 numbered student pages, got ${studentPages}`);
ok(pdf.getPageCount()===studentPages+1,`PDF must be cover + ${studentPages} student pages = ${studentPages+1}, got ${pdf.getPageCount()}`);
for(const [i,p] of pdf.getPages().entries()){const {width,height}=p.getSize();ok(Math.abs(width-595.28)<1.5&&Math.abs(height-841.89)<1.5,`PDF sheet ${i+1} is not A4`)}
if(fail.length){console.error(`COVER QA FAILED (${fail.length})`);fail.forEach((x,i)=>console.error(`${i+1}. ${x}`));process.exit(1)}
console.log(`COVER QA PASS: designed unnumbered cover + ${studentPages} numbered student pages = ${pdf.getPageCount()} A4 PDF sheets; 49/49 dispositions recorded.`);
