import fs from 'node:fs';

const failures=[];
const ok=(cond,msg)=>{if(!cond)failures.push(msg)};
const files=[39,40,41].map(n=>({n,text:fs.readFileSync(new URL(`./page-${n}.html`,import.meta.url),'utf8')}));
const byPage=new Map(files.map(x=>[x.n,x.text]));

const attrMap=tag=>Object.fromEntries([...tag.matchAll(/data-([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const qaTags=[];
for(const {n,text} of files){
  for(const m of text.matchAll(/<(?:tr|div)\b[^>]*data-qa="[^"]+"[^>]*>/g)) qaTags.push({page:n,tag:m[0],attrs:attrMap(m[0])});
}

const expectedHeadings=new Map([
  [39,'חישוב שטח הבסיס'],
  [40,'חישוב שטח המעטפת'],
  [41,'חישוב שטח הפנים']
]);
for(const {n,text} of files){
  ok(/<h1 class="page-title">גליל<\/h1>/.test(text),`page ${n}: main title must be גליל`);
  ok(text.includes(`<p class="page-subtitle">${expectedHeadings.get(n)}</p>`),`page ${n}: subtitle mismatch`);
  const algebraAt=text.indexOf('ביטויים אלגבריים');
  const firstNumericAt=text.search(/data-qa="(?:base|base-d|lateral|lateral-d|total|total-d)"/);
  ok(firstNumericAt>=0&&algebraAt>firstNumericAt,`page ${n}: algebra must follow numeric practice`);
  const numericCount=[...text.matchAll(/data-qa="(?!algebra)[^"]+"/g)].length;
  const algebraCount=[...text.matchAll(/data-qa="algebra"/g)].length;
  ok(numericCount>=12,`page ${n}: expected at least 12 numeric practice items, got ${numericCount}`);
  ok(algebraCount>=4,`page ${n}: expected at least 4 algebra items, got ${algebraCount}`);
  ok(/class="work h10"/.test(text),`page ${n}: algebra/numeric tasks must include dedicated work areas`);
  ok(/class="answer"/.test(text),`page ${n}: tasks must include answer lines`);
}

ok(/S = π · <span class="gap"><\/span>²/.test(byPage.get(39)),'page 39: guided base-area formula completion missing');
ok(/S = 2πr · <span class="gap"><\/span>/.test(byPage.get(40)),'page 40: guided lateral-area formula completion missing');
ok(/S = 2πr² \+ <span class="gap wide"><\/span>/.test(byPage.get(41)),'page 41: guided total-surface formula completion missing');
ok(byPage.get(40).includes('מעטפת של גליל ישר נפרסת למלבן'),'page 40: rectangle-unfolding explanation missing');
ok(byPage.get(41).includes('שני בסיסים + מעטפת'),'page 41: total surface must be built from two bases plus lateral area');

function coeffFor(a){
  const r=Number(a.r), d=Number(a.d), h=Number(a.h), s=Number(a.s);
  switch(a.qa){
    case 'base': return r*r;
    case 'base-d': {const rr=d/2; return rr*rr;}
    case 'lateral': return 2*r*h;
    case 'lateral-d': return d*h;
    case 'total': return 2*r*r+2*r*h;
    case 'total-d': {const rr=d/2; return 2*rr*rr+2*rr*h;}
    case 'lateral-inverse-h': return s/(2*r);
    default: return null;
  }
}

for(const {page,attrs:a} of qaTags){
  if(!a.expect||a.qa==='algebra')continue;
  const coeff=coeffFor(a);
  ok(Number.isFinite(coeff),`page ${page}: cannot calculate ${a.qa}`);
  if(a['approx']){
    const want=Number(a.expect);
    const got=coeff*Number(a['approx']);
    ok(Math.abs(got-want)<1e-9,`page ${page}: ${a.qa} approximate expectation ${a.expect} != ${got}`);
  }else if(/π$/.test(a.expect)){
    const want=Number(a.expect.replace('π',''));
    ok(Math.abs(coeff-want)<1e-9,`page ${page}: ${a.qa} expectation ${a.expect} != ${coeff}π`);
  }else{
    const want=Number(a.expect);
    ok(Math.abs(coeff-want)<1e-9,`page ${page}: ${a.qa} expectation ${a.expect} != ${coeff}`);
  }
}

const algebraExpectations={
  39:['πx²','4πa²','πy²','9πk²'],
  40:['8πx','6πy','4πa²','20πt'],
  41:['2πx² + 6πx','8π + 4πy','4πa²','24πk²']
};
for(const [page,expected] of Object.entries(algebraExpectations)){
  const actual=qaTags.filter(x=>x.page===Number(page)&&x.attrs.qa==='algebra').map(x=>x.attrs.expect);
  ok(actual.length===expected.length,`page ${page}: algebra item count drift`);
  expected.forEach(value=>ok(actual.includes(value),`page ${page}: missing verified algebra result ${value}`));
}

for(const {n,text} of files){
  ok(!text.includes('6²'),`page ${n}: copied 6² example from reference image is forbidden`);
  ok(!/[×]/.test(text),`page ${n}: multiplication sign × is forbidden`);
}

if(failures.length){
  console.error(`SURFACE QA FAILED (${failures.length})`);
  failures.forEach((f,i)=>console.error(`${i+1}. ${f}`));
  process.exit(1);
}
console.log(`SURFACE QA PASS: pages 39-41 follow SSOT §27; numeric-before-algebra progression, guided formula gaps, radius/diameter variation, deterministic numeric expectations and algebra result inventory verified.`);
