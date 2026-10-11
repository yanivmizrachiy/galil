import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const failures=[];
const ok=(cond,msg)=>{if(!cond)failures.push(msg)};
const root=process.cwd();
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.pdf':'application/pdf'};
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

// Hard timeout + finally-close: a stuck headless run must never hang CI or leak browser processes.
const hardTimeout=setTimeout(()=>{console.error('BROWSER QA FAILED: hard timeout (600s)');process.exit(1);},600000);
let browser;
try{
fs.mkdirSync('qa-artifacts',{recursive:true});
browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1200}});
const consoleErrors=[];
page.on('pageerror',e=>consoleErrors.push(`pageerror: ${e.message}`));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(`console: ${m.text()}`)});
// Broken links/assets: every same-origin request must succeed; nothing external may load on open (§19 video facade).
const networkErrors=[];
const externalRequests=[];
page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)networkErrors.push(`${r.status()} ${r.url()}`)});
// net::ERR_ABORTED is a request cancelled by the test's own navigation (e.g. lazy frames when leaving the reader), not a broken asset.
page.on('requestfailed',r=>{const e=r.failure()?.errorText||'';if(r.url().startsWith(base)&&!/ERR_ABORTED/.test(e))networkErrors.push(`failed ${r.url()} (${e})`)});
page.on('request',r=>{const u=r.url();if(!u.startsWith(base)&&!/^(data|blob|about):/.test(u))externalRequests.push(u)});
// Wait until MathJax has typeset and fonts are ready, so screenshots/PDF never capture raw TeX.
const settle=async()=>{await page.evaluate(async()=>{if(window.MathJax?.startup?.promise)await window.MathJax.startup.promise;await document.fonts.ready;});};

const mmPx=96/25.4;
const expectedW=210*mmPx;
const expectedH=297*mmPx;
const combined=await PDFDocument.create();

for(const n of pages){
  await page.goto(`${base}page-${n}.html`,{waitUntil:'load'});
  await settle();
  await page.waitForTimeout(30);
  const audit=await page.evaluate(()=>{
    const p=document.querySelector('.a4-page');
    const cs=getComputedStyle(p);
    const r=p.getBoundingClientRect();
    const mm=96/25.4;
    // Footer zone: everything rendered must end above the reserved bottom padding (credit footer + blue rule).
    let contentBottom=0;
    for(const el of p.querySelectorAll('*')){const b=el.getBoundingClientRect();if(b.width&&b.height)contentBottom=Math.max(contentBottom,b.bottom);}
    const footerTop=r.top+parseFloat(cs.height)-parseFloat(cs.paddingBottom);
    // SOURCE_OF_TRUTH.md §17: question/sub-section markers are single solid blue dots with no visible digits/letters.
    const markerSel='.task-row>.task-num, .q-item .q-num, .official-page .official-q>p>b:first-child, .official-page .q-item .q-text>b:first-child';
    const markers=[...p.querySelectorAll(markerSel)].map(el=>{const c=getComputedStyle(el),b=el.getBoundingClientRect(),after=getComputedStyle(el,'::after').content;
      return {text:el.textContent.trim(),fs:parseFloat(c.fontSize),color:c.color,bg:c.backgroundColor,radius:c.borderTopLeftRadius,w:b.width/mm,h:b.height/mm,after};});
    const tasksWithoutMarker=[...p.querySelectorAll('section.task')].filter(t=>!t.querySelector(':scope>.task-row>.task-num')).length;
    // Visible numbering at the start of a question/sub-section block (only rendered, non-zero-size text counts).
    const firstVisibleText=block=>{const w=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let t;while((t=w.nextNode())){const c=getComputedStyle(t.parentElement);if(t.textContent.trim()&&parseFloat(c.fontSize)>0&&c.color!=='rgba(0, 0, 0, 0)'&&!t.parentElement.closest('mjx-container'))return t.textContent.replace(/\s+/g,' ').trim();}return '';};
    const numbered=[...p.querySelectorAll('.instruction, .q-text, .official-q>p, .task-body>p')].map(firstVisibleText)
      .filter(t=>/^(\(?[1-9]\d?\s*[.)]|[א-י]['׳]?\s*[.)—–-]\s|\([א-י1-9]\))/.test(t));
    const anchors=[...p.querySelectorAll('.anchor')];
    return {
      w:parseFloat(cs.width),h:parseFloat(cs.height),
      rectW:r.width,rectH:r.height,
      internalOverflow:p.scrollWidth>p.clientWidth+1||p.scrollHeight>p.clientHeight+1,
      bodyOverflow:document.documentElement.scrollWidth>innerWidth+1,
      intoFooter:contentBottom-footerTop,
      h1:document.querySelectorAll('h1').length,
      dir:document.documentElement.dir,
      lang:document.documentElement.lang,
      pageNumber:document.querySelector('.page-number')?.textContent?.trim()||'',
      markers,tasksWithoutMarker,numbered,
      anchors:anchors.length,anchorsWithoutGap:anchors.filter(a=>!a.querySelector('.gap')).length,
      mathErrors:p.querySelectorAll('mjx-merror').length,
      rawTex:/\\\(|\\\)|\\pi\b|\\cdot\b|\\frac\b|\\underline\b/.test(p.innerText)
    };
  });
  ok(Math.abs(audit.w-expectedW)<2&&Math.abs(audit.h-expectedH)<2,`page ${n}: A4 geometry drift ${audit.w}x${audit.h}`);
  ok(!audit.internalOverflow,`page ${n}: internal A4 overflow`);
  ok(!audit.bodyOverflow,`page ${n}: desktop horizontal overflow`);
  ok(audit.intoFooter<=1,`page ${n}: content runs ${Math.round(audit.intoFooter)}px into the reserved footer zone (§16/§17)`);
  ok(audit.h1===1,`page ${n}: expected exactly one h1`);
  ok(audit.dir==='rtl'&&audit.lang==='he',`page ${n}: Hebrew RTL root missing`);
  ok(audit.pageNumber===String(n),`page ${n}: visible page number mismatch (${audit.pageNumber})`);
  ok(audit.mathErrors===0&&!audit.rawTex,`page ${n}: MathJax did not typeset cleanly (merror=${audit.mathErrors}, raw TeX visible=${audit.rawTex})`);
  ok(audit.tasksWithoutMarker===0,`page ${n}: ${audit.tasksWithoutMarker} question(s) without a blue marker (§17)`);
  for(const m of audit.markers){
    const hiddenText=m.fs===0||m.color==='rgba(0, 0, 0, 0)';
    ok(hiddenText,`page ${n}: question/sub-section marker shows its number/letter "${m.text}" (font-size ${m.fs}, color ${m.color}) — §17 forbids visible numbering`);
    ok(m.bg==='rgb(29, 78, 216)'&&m.radius==='50%'&&m.w>2.5&&m.w<4.6&&Math.abs(m.w-m.h)<0.3,`page ${n}: marker "${m.text}" is not a compact single solid blue dot (${JSON.stringify(m)})`);
    ok(m.after==='none'||m.after==='normal',`page ${n}: marker "${m.text}" draws a nested ::after circle (§17 single dot)`);
  }
  ok(audit.numbered.length===0,`page ${n}: visible question/sub-section numbering ${JSON.stringify(audit.numbered)} (§17)`);
  // §8: every anchor box carries a completion gap; §17: page 1 opens without an anchor box.
  if(n===1) ok(audit.anchors===0,'page 1: the opening anchor box was deleted per §17 and must not return');
  ok(audit.anchorsWithoutGap===0,`page ${n}: ${audit.anchorsWithoutGap} anchor box(es) without a completion gap (§8)`);
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
  const shell=await page.evaluate(()=>{
    const dl=document.querySelector('#download');
    const counter=document.querySelector('#counter');
    const card=document.querySelector('.sheet-card');
    return {
      overflow:document.documentElement.scrollWidth>innerWidth+1,
      vertical:(()=>{const vw=document.documentElement.clientWidth;const wide=[...document.querySelectorAll('.bar,#reader,.sheet-card,.sheet-card iframe')].filter(el=>{const r=el.getBoundingClientRect();return r.left<-1||r.right>vw+1||el.scrollWidth>el.clientWidth+1}).length;
        const cs=getComputedStyle(document.documentElement),bs=getComputedStyle(document.body);
        return {vw,scrollW:document.documentElement.scrollWidth,bodyScrollW:document.body.scrollWidth,wide,ox:cs.overflowX,bodyOx:bs.overflowX,touch:cs.touchAction,bodyTouch:bs.touchAction,osx:cs.overscrollBehaviorX,readerOx:getComputedStyle(document.getElementById('reader')).overflowX}})(),
      cards:document.querySelectorAll('.sheet-card').length,
      buttons:document.querySelectorAll('button').length,
      forbidden:['#singleMode','#continuousMode','#prev','#next','#page'].filter(s=>document.querySelector(s)).join(','),
      barActions:document.querySelectorAll('.bar a, .bar button').length,
      dlText:dl?dl.textContent.replace(/\s+/g,' ').trim():null,
      dlDownload:dl?dl.hasAttribute('download'):false,
      dlHref:dl?dl.getAttribute('href'):null,
      counterTag:counter?counter.tagName.toLowerCase():null,
      counterText:counter?(counter.tagName==='SELECT'?counter.options[counter.selectedIndex]?.textContent.trim():counter.textContent.trim()):null,
      counterIsSelect:counter?.tagName==='SELECT',
      counterVisible:counter?getComputedStyle(counter).display!=='none'&&counter.getBoundingClientRect().height>0:false,
      snap:card?getComputedStyle(card).scrollSnapAlign:'',
      firstFrame:(()=>{const f=document.querySelector('.sheet-card iframe');if(!f)return null;const r=f.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}})(),
      separator:(()=>{const f=card?.querySelector('iframe'),next=card?.nextElementSibling;if(!f||!next)return null;
        const cs=getComputedStyle(card),fc=getComputedStyle(f);
        return {gap:next.getBoundingClientRect().top-f.getBoundingClientRect().bottom,line:parseFloat(cs.borderBottomWidth),color:cs.borderBottomColor,
          margin:parseFloat(cs.marginBottom),padding:parseFloat(cs.paddingBottom),frameBorder:parseFloat(fc.borderWidth),frameRadius:parseFloat(fc.borderRadius),frameShadow:fc.boxShadow}})()
    };
  });
  ok(!shell.overflow,`${label}: reader shell has horizontal overflow`);
  // §19 mobile vertical-only: nothing may create horizontal layout width; gestures pan-y + pinch-zoom.
  ok(shell.vertical.scrollW<=shell.vertical.vw+1&&shell.vertical.bodyScrollW<=shell.vertical.vw+1,`${label}: horizontal layout width detected (scrollWidth ${shell.vertical.scrollW}/${shell.vertical.bodyScrollW} > viewport ${shell.vertical.vw})`);
  ok(shell.vertical.wide===0,`${label}: ${shell.vertical.wide} bar/reader/card/iframe element(s) exceed the viewport width`);
  ok(shell.vertical.ox==='clip'&&shell.vertical.bodyOx==='clip'&&shell.vertical.readerOx==='clip',`${label}: overflow-x must be clip on html/body/#reader (got ${shell.vertical.ox}/${shell.vertical.bodyOx}/${shell.vertical.readerOx})`);
  ok(/pan-y/.test(shell.vertical.touch)&&/pinch-zoom/.test(shell.vertical.touch)&&/pan-y/.test(shell.vertical.bodyTouch),`${label}: touch-action must be pan-y pinch-zoom (got ${shell.vertical.touch} / ${shell.vertical.bodyTouch})`);
  ok(shell.vertical.osx==='none',`${label}: overscroll-behavior-x must be none (got ${shell.vertical.osx})`);
  ok(shell.cards===total,`${label}: expected ${total} continuous cards, got ${shell.cards}`);
  ok(shell.buttons===0,`${label}: reader must expose no <button> (found ${shell.buttons})`);
  ok(!shell.forbidden,`${label}: removed controls still present (${shell.forbidden})`);
  ok(shell.barActions===1,`${label}: visible bar must have exactly one action, found ${shell.barActions}`);
  ok(shell.dlText&&shell.dlText.includes('הורדת PDF'),`${label}: the one action must read "הורדת PDF" (got "${shell.dlText}")`);
  ok(shell.dlDownload&&/\.pdf$/i.test(shell.dlHref||''),`${label}: action must be a static .pdf download link (download=${shell.dlDownload}, href=${shell.dlHref})`);
  ok(shell.counterIsSelect&&shell.counterVisible,`${label}: page selector must be a visible <select> (tag=${shell.counterTag}, visible=${shell.counterVisible})`);
  ok(new RegExp(`עמוד\\s*1\\s*מתוך\\s*${total}`).test(shell.counterText||''),`${label}: counter should start at "עמוד 1 מתוך ${total}" (got "${shell.counterText}")`);
  ok(shell.snap==='start',`${label}: cards must use scroll-snap-align:start (got "${shell.snap}")`);
  if(shell.firstFrame)ok(shell.firstFrame.left>=-1&&shell.firstFrame.right<=width+1,`${label}: first iframe clipped (${shell.firstFrame.left}, ${shell.firstFrame.right})`);
  const sep=shell.separator;
  ok(sep&&Math.abs(sep.gap-3)<1&&sep.line===3&&sep.color==='rgb(29, 78, 216)'&&sep.margin===0&&sep.padding===0,
    `${label}: pages must meet at only the 3px blue separator (${JSON.stringify(sep)})`);
  ok(sep&&sep.frameBorder===0&&sep.frameRadius===0&&sep.frameShadow==='none',`${label}: page frames must not add borders, rounded corners or shadows between pages`);

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
  ok(scaled&&scaled.w<=scaled.frame+2,`${label}: A4 wider than its iframe (${scaled?.w}/${scaled?.frame})`);
  ok(scaled&&scaled.left>=-2&&scaled.right<=scaled.frame+2,`${label}: A4 is outside its iframe viewport (${scaled?.left}, ${scaled?.right}, frame ${scaled?.frame})`);
  ok(scaled&&scaled.textLength>30,`${label}: first A4 has no readable content`);
  ok(scaled&&scaled.pageDirection==='rtl',`${label}: A4 must remain RTL`);
  if(scaled&&scaled.frame<expectedW)ok(scaled.bodyDirection==='ltr',`${label}: scaled wrapper must position the RTL A4 from its left edge`);
  const frameShot=`qa-artifacts/reader-${label}-first-page.png`;
  await firstFrame.screenshot({path:frameShot});
  ok(fs.statSync(frameShot).size>25000,`${label}: first-page screenshot is suspiciously blank (${fs.statSync(frameShot).size} bytes)`);
  await page.screenshot({path:`qa-artifacts/reader-${label}.png`,fullPage:false});
}

await inspectReader(360,800,'android-portrait');
await inspectReader(915,412,'android-landscape');
await inspectReader(390,844,'iphone-portrait');
await inspectReader(844,390,'iphone-landscape');
for(const width of [700,701,740,768,800])await inspectReader(width,1000,`width-${width}`);
await inspectReader(1440,1200,'desktop');

// Sticky counter updates automatically as the reader scrolls (desktop).
await page.setViewportSize({width:1440,height:1200});
await page.goto(base,{waitUntil:'load'});
await page.waitForFunction(t=>document.querySelectorAll('.sheet-card').length===t,total);
await page.evaluate(()=>document.getElementById('sheet-12').scrollIntoView());
await page.waitForTimeout(450);
const counterNow=await page.$eval('#counter',el=>el.options[el.selectedIndex].textContent.trim());
const counterNum=Number((counterNow.match(/עמוד\s*(\d+)/)||[])[1]||0);
ok(counterNum>1,`sticky counter did not update on scroll (still "${counterNow}")`);

// §19 page selector: choosing a page jumps straight there with a short fade — no smooth scroll through all pages.
await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
await page.waitForTimeout(200);
const jumpTarget=Math.min(total,30);
const t0=Date.now();
await page.selectOption('#counter',String(jumpTarget));
const fadingSeen=await page.waitForFunction(()=>document.getElementById('reader').classList.contains('fading'),null,{timeout:1000}).then(()=>true).catch(()=>false);
ok(fadingSeen,'selecting a page must add the #reader.fading class (fade-out) before the jump');
await page.waitForFunction(()=>!document.getElementById('reader').classList.contains('fading'),null,{timeout:2000});
const jumpMs=Date.now()-t0;
const after=await page.evaluate((n)=>{const c=document.getElementById(`sheet-${n}`).getBoundingClientRect();const bar=document.querySelector('.bar').getBoundingClientRect();
  return {top:c.top-bar.bottom,sel:Number(document.getElementById('counter').value),hash:location.hash,transition:getComputedStyle(document.getElementById('reader')).transitionDuration};},jumpTarget);
ok(after.top>-2&&after.top<40,`selector jump must land page ${jumpTarget} directly under the sticky bar (offset ${Math.round(after.top)}px)`);
ok(after.sel===jumpTarget&&after.hash===`#page=${jumpTarget}`,`selector/hash must reflect the jumped page (sel=${after.sel}, hash=${after.hash})`);
ok(jumpMs<900,`page jump must be a short fade-jump, not a long smooth scroll (${jumpMs}ms)`);
const tr=parseFloat(after.transition)*(/ms$/.test(after.transition)?1:1000);
ok(tr>=150&&tr<=220,`#reader fade transition must be 150–220ms (got ${after.transition})`);
await page.waitForTimeout(300);
const stillSel=await page.$eval('#counter',el=>Number(el.value));
ok(stillSel===jumpTarget,`selector must stay on page ${jumpTarget} after the jump settles (got ${stillSel})`);
await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
await page.waitForTimeout(400);

// The bar holding the counter stays pinned near the top of the viewport while scrolled (R4 / §19).
const pinned=await page.evaluate(()=>{
  const bar=document.querySelector('.bar');const c=document.getElementById('counter');
  const bs=getComputedStyle(bar);const r=c.getBoundingClientRect();
  return {pos:bs.position, top:r.top, h:bar.getBoundingClientRect().height};
});
ok(pinned.pos==='sticky','bar must be position:sticky at runtime');
ok(pinned.top>=-1&&pinned.top<=pinned.h+2,`sticky counter must stay pinned near the top while scrolled (got top=${pinned.top})`);

// The one action downloads a real static same-origin PDF (not generated on click).
const dl=await page.evaluate(async()=>{
  const a=document.querySelector('#download'); if(!a)return null;
  const url=new URL(a.getAttribute('href'),location.href);
  const res=await fetch(url.href);
  const buf=new Uint8Array(await res.arrayBuffer());
  return {sameOrigin:url.origin===location.origin,status:res.status,
    type:res.headers.get('content-type')||'',isPdf:String.fromCharCode(...buf.slice(0,5)).startsWith('%PDF'),bytes:buf.length};
});
ok(dl&&dl.sameOrigin,'download link must be same-origin');
ok(dl&&dl.status===200&&dl.isPdf&&/pdf/i.test(dl.type),`download must serve a real static PDF (status ${dl?.status}, type ${dl?.type}, pdf ${dl?.isPdf})`);
ok(dl&&dl.bytes>50000,`static PDF suspiciously small (${dl?.bytes} bytes)`);

// §19 print: the reader chrome (bar + intro video) is screen-only; the PDF/print stays worksheets only.
await page.emulateMedia({media:'print'});
const printHidden=await page.evaluate(()=>['.bar','.intro-video'].map(s=>{const el=document.querySelector(s);return el?getComputedStyle(el).display:'missing'}));
ok(printHidden.every(d=>d==='none'),`print media must hide the reader bar and intro video (got ${printHidden.join('/')})`);
await page.emulateMedia({media:'screen'});

// §19 deep link #page=N: a fresh load (and a reload) lands on page N under the sticky bar, with the selector on N;
// out-of-range values clamp to the first/last page. Checked on desktop, tablet and phone (where the bar wraps).
async function openDeepLink(hash){
  await page.goto('about:blank');
  await page.goto(`${base}${hash}`,{waitUntil:'load'});
  await page.waitForFunction(t=>document.querySelectorAll('.sheet-card').length===t,total);
  await page.waitForTimeout(900);
}
async function landing(n){
  return page.evaluate(n=>{const c=document.getElementById(`sheet-${n}`).getBoundingClientRect();const bar=document.querySelector('.bar').getBoundingClientRect();
    return {offset:c.top-bar.bottom,visible:c.top<innerHeight&&c.bottom>bar.bottom,atBottom:scrollY+innerHeight>=document.documentElement.scrollHeight-2,
      sel:Number(document.getElementById('counter').value),hash:location.hash};},n);
}
for(const [w,h,label] of [[1440,1200,'desktop'],[768,1000,'tablet'],[390,844,'phone']]){
  await page.setViewportSize({width:w,height:h});
  // Selector jump on this viewport: the chosen page lands fully below the (possibly wrapped) sticky bar.
  await openDeepLink('');
  await page.selectOption('#counter','30');
  await page.waitForFunction(()=>!document.getElementById('reader').classList.contains('fading'),null,{timeout:2000});
  await page.waitForTimeout(900);
  const jumped=await landing(30);
  ok(jumped.offset>-3&&jumped.offset<40&&jumped.sel===30,`${label}: selector jump must land page 30 under the sticky bar (offset ${Math.round(jumped.offset)}px, selector ${jumped.sel})`);
  for(const [hash,n] of [['#page=37',37],['#page=1',1],[`#page=${total}`,total],['#page=999',total]]){
    await openDeepLink(hash);
    const at=await landing(n);
    // The last card cannot reach the top on a phone (it is shorter than the viewport): then it must be the visible end of the scroll.
    const placed=(at.offset>-3&&at.offset<40)||(n===total&&at.visible&&at.atBottom);
    ok(placed,`${label} deep link ${hash}: page ${n} must land under the sticky bar (offset ${Math.round(at.offset)}px, atBottom ${at.atBottom})`);
    ok(at.sel===n,`${label} deep link ${hash}: selector must show page ${n} (got ${at.sel})`);
    // §19 lazy loading without layout jumps: frames are pre-sized to their fitted A4 size, so loading them does not shift the page.
    if(hash==='#page=37'){
      const cls=await page.evaluate(()=>new Promise(r=>{let sum=0;const o=new PerformanceObserver(l=>{for(const e of l.getEntries()) if(!e.hadRecentInput) sum+=e.value;});
        o.observe({type:'layout-shift',buffered:true});setTimeout(()=>{o.disconnect();r(sum);},200);}));
      ok(cls<0.1,`${label} deep link ${hash}: lazy page frames must not jump the layout while loading (cumulative layout shift ${cls.toFixed(3)} ≥ 0.1)`);
    }
  }
  // The landing alignment must never fight the reader: a wheel gesture over a page frame right after a deep link scrolls freely.
  await openDeepLink('#page=37');
  await page.mouse.move(Math.round(w/2),Math.round(h*0.6));
  await page.mouse.wheel(0,700);
  await page.waitForTimeout(1200);
  const moved=await landing(37);
  ok(moved.offset<-300,`${label}: a wheel gesture right after deep link #page=37 must scroll away from it, not be pulled back (offset ${Math.round(moved.offset)}px)`);
  // Reload keeps the reader on the page the hash names (the hash follows manual scrolling via replaceState).
  await openDeepLink('#page=1');
  await page.mouse.move(Math.round(w/2),Math.round(h*0.6));
  await page.mouse.wheel(0,200);
  await page.waitForTimeout(300);
  await page.evaluate(()=>document.getElementById('sheet-12').scrollIntoView({block:'start',behavior:'instant'}));
  await page.waitForFunction(()=>location.hash==='#page=12',null,{timeout:3000}).catch(()=>{});
  ok(await page.evaluate(()=>location.hash)==='#page=12',`${label}: manual scroll to page 12 must update the hash to #page=12`);
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(t=>document.querySelectorAll('.sheet-card').length===t,total);
  await page.waitForTimeout(900);
  const re=await landing(12);
  ok(re.offset>-3&&re.offset<40&&re.sel===12,`${label}: reload must return to page 12 (offset ${Math.round(re.offset)}px, selector ${re.sel})`);
}

// §19 intro video: nothing external loads when the reader opens; a click swaps the facade for a youtube-nocookie player.
ok(externalRequests.length===0,`reader/pages must not load external resources before a click (got ${[...new Set(externalRequests)].slice(0,5).join(', ')})`);
await page.setViewportSize({width:1440,height:1200});
await page.route('https://www.youtube-nocookie.com/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>stub</title>'}));
await page.goto('about:blank');
await page.goto(base,{waitUntil:'load'});
ok(await page.locator('#videoFacade').count()===1&&await page.locator('iframe.video-frame').count()===0,'intro video must start as a facade without a player iframe');
await page.click('#videoFacade');
const player=await page.locator('iframe.video-frame').getAttribute('src').catch(()=>null);
ok(/^https:\/\/www\.youtube-nocookie\.com\/embed\/l4vvuHCY1QI\b/.test(player||''),`clicking the facade must load the youtube-nocookie player (got ${player})`);
const firstSheetAfterVideo=await page.evaluate(()=>{const v=document.querySelector('.intro-video').getBoundingClientRect(),s=document.getElementById('sheet-1').getBoundingClientRect();return s.top>=v.bottom-1;});
ok(firstSheetAfterVideo,'the student pages must follow directly after the intro video');
await page.unroute('https://www.youtube-nocookie.com/**');

// Mobile A4 fit of the newer/official pages inside the continuous reader (no single-page view exists).
await page.setViewportSize({width:390,height:844});
await page.goto(base,{waitUntil:'load'});
await page.waitForFunction(t=>document.querySelectorAll('.sheet-card').length===t,total);
for(const n of [39,40,41,42,43,44,45,46,47,48,49]){
  await page.evaluate(n=>document.getElementById(`sheet-${n}`).scrollIntoView(),n);
  await page.waitForFunction(n=>{
    const f=document.querySelector(`#sheet-${n} iframe`);
    const p=f?.contentDocument?.querySelector('.a4-page');
    return Boolean(p && p.textContent.trim().length>30);
  },n,{timeout:5000});
  await page.waitForTimeout(150);
  const fit=await page.locator(`#sheet-${n} iframe`).evaluate(f=>{
    const p=f.contentDocument?.querySelector('.a4-page'); if(!p)return null;
    const r=p.getBoundingClientRect(); return {pageW:r.width,left:r.left,right:r.right,frameW:f.clientWidth};
  });
  ok(fit&&fit.pageW<=fit.frameW+2&&fit.left>=-2&&fit.right<=fit.frameW+2,`mobile continuous page ${n}: clipping (${JSON.stringify(fit)})`);
  if(n>=44) await page.locator(`#sheet-${n} iframe`).screenshot({path:`qa-artifacts/official-page-${n}-mobile.png`});
}

// The sticky counter must reach the final page at the very bottom of the scroll on phones (§19 / R4),
// where every A4 card is shorter than the viewport. Defeat scroll-behavior:smooth and lazy-load
// height shifts by jumping to the end repeatedly (instant) until the viewport is truly pinned there.
for(const [w,h] of [[390,844],[360,800]]){
  await page.setViewportSize({width:w,height:h});
  await page.goto(base,{waitUntil:'load'});
  await page.waitForFunction(t=>document.querySelectorAll('.sheet-card').length===t,total);
  const reached=await page.evaluate(async()=>{
    document.documentElement.style.scrollBehavior='auto';
    const atBottom=()=>window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-2;
    for(let i=0;i<80 && !atBottom();i++){ window.scrollTo(0,document.documentElement.scrollHeight); await new Promise(r=>setTimeout(r,80)); }
    return atBottom();
  });
  await page.waitForTimeout(300);
  ok(reached,`${w}x${h}: test could not reach the bottom of the reader scroll`);
  const last=await page.$eval('#counter',el=>el.options[el.selectedIndex].textContent.trim());
  ok(new RegExp(`עמוד\\s*${total}\\s*מתוך\\s*${total}`).test(last),
     `${w}x${h}: counter must reach "עמוד ${total} מתוך ${total}" at the bottom of the scroll (got "${last}")`);
}

ok(consoleErrors.length===0,`browser console errors: ${consoleErrors.join(' | ')}`);
ok(networkErrors.length===0,`broken same-origin links/assets: ${[...new Set(networkErrors)].join(' | ')}`);
}catch(error){
  failures.push(`browser QA crashed: ${error.stack||error.message}`);
}finally{
  if(browser) await browser.close().catch(()=>{});
  await new Promise(resolve=>server.close(resolve));
  clearTimeout(hardTimeout);
}

if(failures.length){
  console.error(`BROWSER QA FAILED (${failures.length})`);
  failures.forEach((f,i)=>console.error(`${i+1}. ${f}`));
  process.exit(1);
}
console.log(`BROWSER QA PASS: ${total} A4 pages, ${total} page screenshots, combined ${total}-page A4 PDF, continuous-only reader with one "הורדת PDF" action serving a real static same-origin PDF, sticky compact page selector (select, not a button) that follows the scroll and fade-jumps on change, gentle scroll-snap, Android/iPhone portrait+landscape with painted first-page evidence, pages 39-49 mobile continuous-view fit, official pages 44-49 mobile screenshots, no SVG label on a drawing line (§15), no horizontal/internal overflow or footer-zone intrusion, mobile vertical-only (overflow-x clipped on shell+pages, pan-y + pinch-zoom), compact solid blue markers with no visible question/sub-section numbering (§17), a completion gap in every anchor (§8), MathJax typeset before capture, selector jumps, #page=N deep links (first/last/clamped) and reload landing fully below the sticky bar on desktop/tablet/phone without fighting user scroll gestures or lazy-load layout jumps, print hides reader chrome, click-to-load youtube-nocookie video with no external request on open, and no broken same-origin assets.`);
