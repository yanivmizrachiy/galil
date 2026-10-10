import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const failures=[];
const ok=(cond,msg)=>{if(!cond)failures.push(msg)};
const root=process.cwd();
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const pages=fs.readdirSync(root).filter(n=>/^page-\d+\.html$/.test(n)).map(n=>Number(n.match(/\d+/)[0])).sort((a,b)=>a-b);
const total=pages.length;

const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  const rel=pathname==='/'?'index.html':pathname.replace(/^\//,'');
  const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html')){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,buf)=>{
    if(err){res.writeHead(404);res.end('not found');return;}
    res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
    res.end(buf);
  });
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address();
const base=`http://127.0.0.1:${port}/`;

fs.mkdirSync('qa-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1200}});
const consoleErrors=[];
page.on('pageerror',e=>consoleErrors.push(`pageerror: ${e.message}`));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(`console: ${m.text()}`)});

const mmPx=96/25.4;
const expectedW=210*mmPx;
const expectedH=297*mmPx;
const combined=await PDFDocument.create();

for(const n of pages){
  await page.goto(`${base}page-${n}.html`,{waitUntil:'load'});
  await page.waitForTimeout(30);
  const audit=await page.evaluate(()=>{
    const p=document.querySelector('.a4-page');
    const cs=getComputedStyle(p);
    const r=p.getBoundingClientRect();
    return {
      w:parseFloat(cs.width),h:parseFloat(cs.height),
      rectW:r.width,rectH:r.height,
      internalOverflow:p.scrollWidth>p.clientWidth+1||p.scrollHeight>p.clientHeight+1,
      bodyOverflow:document.documentElement.scrollWidth>innerWidth+1,
      h1:document.querySelectorAll('h1').length,
      dir:document.documentElement.dir,
      lang:document.documentElement.lang,
      pageNumber:document.querySelector('.page-number')?.textContent?.trim()||''
    };
  });
  ok(Math.abs(audit.w-expectedW)<2&&Math.abs(audit.h-expectedH)<2,`page ${n}: A4 geometry drift ${audit.w}x${audit.h}`);
  ok(!audit.internalOverflow,`page ${n}: internal A4 overflow`);
  ok(!audit.bodyOverflow,`page ${n}: desktop horizontal overflow`);
  ok(audit.h1===1,`page ${n}: expected exactly one h1`);
  ok(audit.dir==='rtl'&&audit.lang==='he',`page ${n}: Hebrew RTL root missing`);
  ok(audit.pageNumber===String(n),`page ${n}: visible page number mismatch (${audit.pageNumber})`);
  // SOURCE_OF_TRUTH.md §15: no SVG label may sit on a drawing stroke. Rasterize each figure with
  // its <text> removed and fail when a drawing stroke covers more than max(4px, 6%) of a label's glyph box.
  const labelHits=await page.evaluate(async()=>{
    const parseVB=svg=>(svg.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
    const hits=[];
    const svgs=Array.from(document.querySelectorAll('main.a4-page svg'));
    for(let si=0;si<svgs.length;si++){
      const svg=svgs[si];const vb=parseVB(svg);if(vb.length!==4)continue;
      const [minX,minY,vbW,vbH]=vb;
      const texts=Array.from(svg.querySelectorAll('text'));if(!texts.length)continue;
      const sm=svg.getScreenCTM();
      const labels=texts.map(t=>{const b=t.getBBox();let pts=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]];const tm=t.getScreenCTM();if(sm&&tm){const m=sm.inverse().multiply(tm);pts=pts.map(([x,y])=>[m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f]);}const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const nx=Math.min(...xs),ny=Math.min(...ys);return{text:t.textContent.trim(),x:nx,y:ny,w:Math.max(...xs)-nx,h:Math.max(...ys)-ny};});
      const clone=svg.cloneNode(true);
      clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
      clone.setAttribute('width',vbW);clone.setAttribute('height',vbH);
      Array.from(clone.querySelectorAll('text')).forEach(t=>t.remove());
      const svgStr=new XMLSerializer().serializeToString(clone);
      const img=new Image();
      try{await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgStr);});}catch(e){continue;}
      const cv=document.createElement('canvas');
      cv.width=Math.max(1,Math.round(vbW));cv.height=Math.max(1,Math.round(vbH));
      const ctx=cv.getContext('2d');ctx.drawImage(img,0,0,cv.width,cv.height);
      const data=ctx.getImageData(0,0,cv.width,cv.height).data;
      const isStroke=(px,py)=>{if(px<0||py<0||px>=cv.width||py>=cv.height)return false;const i=(py*cv.width+px)*4;if(data[i+3]<50)return false;const luma=0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];return luma<170;};
      for(const L of labels){
        const x0=Math.floor(L.x-minX),y0=Math.floor(L.y-minY),x1=Math.ceil(L.x-minX+L.w),y1=Math.ceil(L.y-minY+L.h);
        let inBox=0,area=0;
        for(let py=y0;py<y1;py++)for(let px=x0;px<x1;px++){area++;if(isStroke(px,py))inBox++;}
        // Fail only on real overlap. A label truly on a line covers ~15-60% of its glyph box;
        // a few antialiased pixels at a box corner (which shift with CI's font fallback) stay well
        // under this tolerance, so the guard is stable across Windows/Linux without masking defects.
        if(inBox>Math.max(4,0.06*area))hits.push({svgIndex:si,label:L.text,inBox,area});
      }
    }
    return hits;
  });
  for(const hit of labelHits){
    ok(false,`page ${n}: SVG label "${hit.label}" (svg#${hit.svgIndex}) sits on a drawing line — ${hit.inBox}/${hit.area} stroke px inside its box (SOURCE_OF_TRUTH.md §15)`);
  }
  await page.locator('.a4-page').screenshot({path:`qa-artifacts/page-${String(n).padStart(2,'0')}.png`});
  const bytes=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,margin:{top:'0',right:'0',bottom:'0',left:'0'}});
  const one=await PDFDocument.load(bytes);
  ok(one.getPageCount()===1,`page ${n}: print produced ${one.getPageCount()} PDF pages instead of 1`);
  const [copied]=await combined.copyPages(one,[0]);
  combined.addPage(copied);
}

const pdfBytes=await combined.save();
fs.writeFileSync('qa-artifacts/galil-student.pdf',pdfBytes);
ok(combined.getPageCount()===total,`combined PDF page count ${combined.getPageCount()} != ${total}`);
for(const [i,p] of combined.getPages().entries()){
  const {width,height}=p.getSize();
  ok(Math.abs(width-595.28)<1.5&&Math.abs(height-841.89)<1.5,`combined PDF page ${i+1}: not A4 (${width}x${height})`);
}

async function inspectReader(width,height,label){
  await page.setViewportSize({width,height});
  await page.goto(base,{waitUntil:'load'});
  await page.waitForFunction(()=>{
    const f=document.querySelector('.sheet-card iframe');
    const p=f?.contentDocument?.querySelector('.a4-page');
    return Boolean(p && p.textContent.trim().length>30 && p.getBoundingClientRect().height>100);
  },null,{timeout:5000});
  await page.waitForTimeout(250);
  const shell=await page.evaluate(()=>({
    overflow:document.documentElement.scrollWidth>innerWidth+1,
    totalText:document.querySelector('#pageTotal')?.textContent?.trim(),
    max:document.querySelector('#page')?.max,
    continuousPressed:document.querySelector('#continuousMode')?.getAttribute('aria-pressed'),
    continuousVisible:getComputedStyle(document.querySelector('#continuousView')).display!=='none',
    cards:document.querySelectorAll('.sheet-card').length,
    firstFrame:(()=>{const f=document.querySelector('.sheet-card iframe');if(!f)return null;const r=f.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}})()
  }));
  ok(!shell.overflow,`${label}: reader shell has horizontal overflow`);
  ok(shell.totalText===String(total)&&shell.max===String(total),`${label}: reader total mismatch`);
  ok(shell.continuousPressed==='true'&&shell.continuousVisible,`${label}: continuous view is not the default`);
  ok(shell.cards===total,`${label}: expected ${total} continuous cards, got ${shell.cards}`);
  if(shell.firstFrame)ok(shell.firstFrame.left>=-1&&shell.firstFrame.right<=width+1,`${label}: first iframe clipped (${shell.firstFrame.left}, ${shell.firstFrame.right})`);

  const firstFrame=page.locator('.sheet-card iframe').first();
  await firstFrame.waitFor({state:'visible'});
  const scaled=await firstFrame.evaluate(f=>{
    const p=f.contentDocument?.querySelector('.a4-page');
    if(!p)return null;
    const r=p.getBoundingClientRect();
    const body=f.contentDocument?.body;
    return {
      w:r.width,left:r.left,right:r.right,frame:f.clientWidth,
      textLength:(p.textContent||'').trim().length,
      bodyDirection:body?getComputedStyle(body).direction:'',
      pageDirection:getComputedStyle(p).direction
    };
  });
  if(width<=700){
    ok(scaled&&scaled.w<=scaled.frame+2,`${label}: scaled A4 wider than mobile iframe (${scaled?.w}/${scaled?.frame})`);
    ok(scaled&&scaled.left>=-2&&scaled.right<=scaled.frame+2,`${label}: scaled A4 is outside portrait iframe viewport (${scaled?.left}, ${scaled?.right}, frame ${scaled?.frame})`);
    ok(scaled&&scaled.textLength>30,`${label}: first mobile A4 has no readable content`);
    ok(scaled&&scaled.bodyDirection==='ltr'&&scaled.pageDirection==='rtl',`${label}: mobile wrapper/page direction contract failed (${scaled?.bodyDirection}/${scaled?.pageDirection})`);
  }
  const frameShot=`qa-artifacts/reader-${label}-first-page.png`;
  await firstFrame.screenshot({path:frameShot});
  ok(fs.statSync(frameShot).size>25000,`${label}: first-page screenshot is suspiciously blank (${fs.statSync(frameShot).size} bytes)`);
  await page.screenshot({path:`qa-artifacts/reader-${label}.png`,fullPage:false});
}

await inspectReader(360,800,'android-portrait');
await inspectReader(915,412,'android-landscape');
await inspectReader(390,844,'iphone-portrait');
await inspectReader(844,390,'iphone-landscape');

// Verify all newly authored surface-area and official-curriculum pages in single-page mobile mode.
await page.setViewportSize({width:390,height:844});
await page.goto(base,{waitUntil:'load'});
await page.click('#singleMode');
for(const n of [39,40,41,42,43,44,45,46,47,48,49]){
  await page.fill('#page',String(n));
  await page.locator('#page').evaluate(el=>el.dispatchEvent(new Event('change',{bubbles:true})));
  await page.waitForFunction(expected=>document.querySelector('#sheet')?.getAttribute('src')===`page-${expected}.html`,n);
  await page.waitForFunction(()=>{
    const f=document.querySelector('#sheet');
    const p=f?.contentDocument?.querySelector('.a4-page');
    return Boolean(p && p.textContent.trim().length>30);
  });
  await page.waitForTimeout(120);
  const fit=await page.locator('#sheet').evaluate(f=>{
    const p=f.contentDocument?.querySelector('.a4-page'); if(!p)return null;
    const r=p.getBoundingClientRect(); return {pageW:r.width,left:r.left,right:r.right,frameW:f.clientWidth,src:f.getAttribute('src')};
  });
  ok(fit&&fit.src===`page-${n}.html`&&fit.pageW<=fit.frameW+2&&fit.left>=-2&&fit.right<=fit.frameW+2,`mobile single view page ${n}: clipping or wrong source`);
  if(n>=44) await page.locator('#sheet').screenshot({path:`qa-artifacts/official-page-${n}-mobile.png`});
}

ok(consoleErrors.length===0,`browser console errors: ${consoleErrors.join(' | ')}`);
await browser.close();
await new Promise(resolve=>server.close(resolve));

if(failures.length){
  console.error(`BROWSER QA FAILED (${failures.length})`);
  failures.forEach((f,i)=>console.error(`${i+1}. ${f}`));
  process.exit(1);
}
console.log(`BROWSER QA PASS: ${total} A4 pages, ${total} page screenshots, combined ${total}-page A4 PDF, continuous reader default, Android/iPhone portrait+landscape with painted first-page evidence, pages 39-49 mobile single-view fit, official pages 44-49 mobile screenshots, no SVG label on a drawing line (§15), no horizontal/internal overflow.`);
