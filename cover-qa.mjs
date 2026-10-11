import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
const fail=[]; const ok=(c,m)=>{if(!c)fail.push(m)};
const cover=fs.readFileSync('cover.html','utf8');
const ssot=fs.readFileSync('SOURCE_OF_TRUTH.md','utf8');
const index=fs.readFileSync('index.html','utf8');
const img=fs.readFileSync('assets/cover-bg.webp');
const disposition=JSON.parse(fs.readFileSync('page-disposition.json','utf8'));
const studentPages=fs.readdirSync('.').filter(n=>/^page-\d+\.html$/.test(n)).length;
ok(/<h1[^>]*>גליל לחטיבת הביניים<\/h1>/.test(cover),'cover title must be גליל לחטיבת הביניים');
ok(cover.includes('assets/cover-bg.webp'),'cover must use the approved local artwork');
ok(!/page-number/.test(cover),'cover must be unnumbered');
ok(img.subarray(0,4).toString()==='RIFF' && img.subarray(8,12).toString()==='WEBP','cover artwork must be a real WebP binary');
ok(index.includes('class="cover-preview"') && index.indexOf('class="cover-preview"') < index.indexOf('class="intro-video"'),'public reader must show cover before video');
ok(ssot.includes('גליל לחטיבת הביניים') && ssot.includes('50 גיליונות'),'SSOT must state the canonical cover + 49-page PDF contract');
ok(disposition.pages?.length===49 && disposition.pages.every((x,i)=>x.page===i+1 && ['A','B','C','D'].includes(x.disposition)),'all 49 pages need a final A/B/C/D disposition');
const pdf=await PDFDocument.load(fs.readFileSync('galil-student.pdf'));
ok(studentPages===49,`expected 49 numbered student pages, got ${studentPages}`);
ok(pdf.getPageCount()===studentPages+1,`PDF must be cover + ${studentPages} student pages = ${studentPages+1}, got ${pdf.getPageCount()}`);
for(const [i,p] of pdf.getPages().entries()){const {width,height}=p.getSize();ok(Math.abs(width-595.28)<1.5&&Math.abs(height-841.89)<1.5,`PDF sheet ${i+1} is not A4`)}
if(fail.length){console.error(`COVER QA FAILED (${fail.length})`);fail.forEach((x,i)=>console.error(`${i+1}. ${x}`));process.exit(1)}
console.log(`COVER QA PASS: approved unnumbered cover + ${studentPages} numbered student pages = ${pdf.getPageCount()} A4 PDF sheets; 49/49 dispositions recorded.`);
