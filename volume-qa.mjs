import fs from 'node:fs';

const failures=[];
const ok=(cond,msg)=>{if(!cond)failures.push(msg)};
const read=n=>fs.readFileSync(new URL(`./page-${n}.html`,import.meta.url),'utf8');
const pages=new Map([25,26,27,28,29,30,31,32,33,34,35,36,37,38].map(n=>[n,read(n)]));
const has=(n,...parts)=>parts.every(part=>pages.get(n).includes(part));

ok(has(25,'נפח = שטח הבסיס·h','12·5 = ____','40·2.5 = ____','100 סמ״ק'),'page 25: base-area-to-volume bridge incomplete');
ok(has(26,'שטח הבסיס = π·r²','נפח = שטח הבסיס·h','נפח = π·r²·h','נפח = 2·π·r·h'),'page 26: guided derivation/distractor set for cylinder volume incomplete');
ok(has(27,'נפח = π·r²·','r → r² → ·h → נפח','7 ס״מ'),'page 27: direct radius/height volume progression incomplete');
ok(has(28,'d → r → ',' → נפח','d=10 → r=5 → ','שטח הבסיס','25π','75π','לחלק את d ב־2'),'page 28: diameter-to-radius-to-volume progression incomplete');
ok(has(29,'r = 1.5','r = 0.5','2.5π סמ״ק'),'page 29: decimal-volume practice or verified example missing');
ok(has(30,'אין מציבים בנוסחת נפח נתונים ביחידות שונות','r = 30','d = 80','r = 0.05','d = 0.12'),'page 30: mixed-unit conversion practice incomplete');
ok(has(31,'שמרו π בתשובה המדויקת','≈','20π','62.83'),'page 31: exact/approx π distinction incomplete');
ok(has(32,'נפח וקיבול','1 סמ״ק = 1 מ״ל','d=10'),'page 32: capacity conversion and diameter case incomplete');
ok(has(33,'מ״ל או ליטר','785 סמ״ק','≈ 785 מ״ל'),'page 33: real-world capacity practice incomplete');
ok(has(34,'קיבול מלא','כמות קיימת','מקום שנשאר','1200 מ״ל'),'page 34: remaining-capacity application incomplete');
ok(has(35,'h = נפח ÷ ','25π סמ״ר','100π סמ״ק'),'page 35: inverse height calculation incomplete');
ok(has(36,'שטח הבסיס = נפח ÷ ','150π ÷ 6','25π סמ״ר'),'page 36: inverse base-area calculation incomplete');
ok(has(37,'נפח ÷ h → ',' → r','r² = ____','שטח הבסיס = 49π','7 ס״מ'),'page 37: inverse radius calculation incomplete');
ok(has(38,'נפח גליל — סיכום','d→r→שטח הבסיס→נפח','1.5 ליטר','שטח הבסיס=16π','נפח=147π','d=80'),'page 38: cumulative volume checkpoint incomplete');

// Deterministic arithmetic sanity checks for canonical numeric examples used in the worksheet.
const piCoeff=(r,h)=>r*r*h;
ok(piCoeff(2,5)===20,'math: r=2,h=5 must produce 20π');
ok(piCoeff(3,4)===36,'math: r=3,h=4 must produce 36π');
ok(piCoeff(5,3)===75,'math: d=10→r=5,h=3 must produce 75π');
ok(piCoeff(0.5,10)===2.5,'math: r=.5,h=10 must produce 2.5π');
ok(100/4===25&&Math.sqrt(25)===5,'math: V=100π,h=4 must produce B=25π,r=5');
ok(147/3===49&&Math.sqrt(49)===7,'math: V=147π,h=3 must produce B=49π,r=7');
ok(150/6===25,'math: V=150π,h=6 must produce B=25π');
ok(80/16===5,'math: V=80π,B=16π must produce h=5');
ok(1200-750===450,'math: 1200 cm³ capacity minus 750 ml must leave 450 ml');

// --- §12 completion-table re-solver -------------------------------------------------
// SOURCE_OF_TRUTH.md §12 requires that every completion-table row (each row = a cylinder)
// be UNIQUELY solvable and that the math QA RE-SOLVE the rows from their declared inputs,
// never trust hard-coded answers. Each completion table is tagged data-complete="<kind>"
// and each data row declares only its INPUTS (data-given, unit-aware) plus the blank
// TARGETS (data-solve) — never the answers. We recompute the row from the givens, assert
// it is fully and consistently determined with clean class-8 results, and guard the
// declared givens against drifting away from the numbers actually printed in the row.
// Kinds:
//   volume              — cylinder π-coefficients: r,d,h,bc(=B/π),vc(=V/π); d=2r, bc=r², vc=bc·h
//   base-volume         — literal base area/volume: bc(=B),h,vc(=V); vc=bc·h (pre-formula, no r/d)
//   capacity-remaining  — literal B,h → full=bc·h (cm³=ml); remaining = full − existing(have)
// A table may carry data-decimal="1" to allow non-integer (decimal/approx/capacity) results;
// the integer and whole-radius guards are then relaxed, but unique determination still holds.
const toCm=(num,unit)=>unit==='mm'?num/10:unit==='m'?num*100:num;
const toMl=(num,unit)=>unit==='L'?num*1000:num; // ml (or bare) stays ml
const LEN=new Set(['r','d','h']);
function parseGiven(spec){
  return spec.split(';').map(part=>{
    const [k,raw]=part.split('=');
    const m=(raw||'').match(/^(-?\d*\.?\d+)(mm|cm|ml|m|L)?$/);
    return m?{k,num:parseFloat(m[1]),unit:m[2]||'',raw:m[1]}:{k,bad:raw};
  });
}
function assignGiven(v,given){
  for(const g of given){
    if(g.bad)return `unparseable given ${g.k}=${g.bad}`;
    if(g.k==='have')v.have=toMl(g.num,g.unit);
    else v[g.k]=LEN.has(g.k)?toCm(g.num,g.unit):g.num;
  }
  return null;
}
function solveVolume(given){ // cylinder π-coefficients
  const v={}; const err=assignGiven(v,given); if(err)return{error:err};
  for(let i=0;i<6;i++){
    if(v.d!=null&&v.r==null)v.r=v.d/2;
    if(v.r!=null&&v.d==null)v.d=2*v.r;
    if(v.r!=null&&v.bc==null)v.bc=v.r*v.r;
    if(v.bc!=null&&v.r==null)v.r=Math.sqrt(v.bc);
    if(v.bc!=null&&v.h!=null&&v.vc==null)v.vc=v.bc*v.h;
    if(v.vc!=null&&v.h!=null&&v.bc==null)v.bc=v.vc/v.h;
    if(v.vc!=null&&v.bc!=null&&v.h==null)v.h=v.vc/v.bc;
  }
  return v;
}
function solveBaseVolume(given){ // literal B·h → V (no radius)
  const v={}; const err=assignGiven(v,given); if(err)return{error:err};
  for(let i=0;i<4;i++){
    if(v.bc!=null&&v.h!=null&&v.vc==null)v.vc=v.bc*v.h;
    if(v.vc!=null&&v.h!=null&&v.bc==null)v.bc=v.vc/v.h;
    if(v.vc!=null&&v.bc!=null&&v.h==null)v.h=v.vc/v.bc;
  }
  return v;
}
function solveRemaining(given){ // full = B·h (cm³=ml); remaining = full − have
  const v={}; const err=assignGiven(v,given); if(err)return{error:err};
  if(v.bc!=null&&v.h!=null)v.full=v.bc*v.h;
  if(v.full!=null&&v.have!=null)v.remaining=v.full-v.have;
  return v;
}
const KINDS={
  'volume':{fields:['r','d','h','bc','vc'],solve:solveVolume,
    consistent:v=>Math.abs(v.d-2*v.r)<1e-9&&Math.abs(v.bc-v.r*v.r)<1e-9&&Math.abs(v.vc-v.bc*v.h)<1e-9},
  'base-volume':{fields:['bc','h','vc'],solve:solveBaseVolume,
    consistent:v=>Math.abs(v.vc-v.bc*v.h)<1e-9},
  'capacity-remaining':{fields:['bc','h','have','full','remaining'],solve:solveRemaining,
    consistent:v=>Math.abs(v.full-v.bc*v.h)<1e-9&&Math.abs(v.remaining-(v.full-v.have))<1e-9,
    nonneg:['full','have','remaining']},
};
const expectedRows={25:4,26:2,27:6,28:5,29:5,30:4,32:3,33:3,34:3,35:4,36:4,37:4};
const tableSrc='<table\\b([^>]*)>([\\s\\S]*?)</table>';
const rowSrc='<tr\\b([^>]*)>([\\s\\S]*?)</tr>';
let solvedRows=0;
const perPage={};
for(const [n,html] of pages){
  let count=0, tm;
  const tre=new RegExp(tableSrc,'g');
  while((tm=tre.exec(html))){
    const tattrs=tm[1], inner=tm[2];
    const cMatch=tattrs.match(/data-complete="([^"]*)"/);
    if(!cMatch)continue; // not a completion table
    const kindName=cMatch[1], kind=KINDS[kindName];
    ok(!!kind,`page ${n}: unknown completion-table kind "${kindName}"`);
    if(!kind)continue;
    const decimal=/data-decimal="1"/.test(tattrs);
    const rre=new RegExp(rowSrc,'g');
    let rm;
    while((rm=rre.exec(inner))){
      const attrs=rm[1], cells=rm[2];
      const gMatch=attrs.match(/data-given="([^"]*)"/);
      if(!gMatch){ if(/data-solve=/.test(attrs)) ok(false,`page ${n}: data-solve without data-given`); continue; }
      const sMatch=attrs.match(/data-solve="([^"]*)"/);
      count++; solvedRows++;
      const tag=gMatch[1];
      const given=parseGiven(tag);
      const solve=(sMatch?sMatch[1]:'').split(',').map(s=>s.trim()).filter(Boolean);
      const v=kind.solve(given);
      if(v.error){ ok(false,`page ${n} row [${tag}]: ${v.error}`); continue; }
      const missing=kind.fields.filter(k=>v[k]==null||!Number.isFinite(v[k]));
      ok(missing.length===0,`page ${n} row [${tag}]: under-determined, missing ${missing.join(',')}`);
      if(missing.length)continue;
      const dump=kind.fields.map(k=>`${k}=${v[k]}`).join(',');
      ok(kind.consistent(v),`page ${n} row [${tag}]: relations inconsistent (${dump})`);
      if(!decimal)
        ok(kind.fields.every(k=>Number.isInteger(v[k])),`page ${n} row [${tag}]: non-integer class-8 result (${dump})`);
      for(const nn of (kind.nonneg||[]))
        ok(v[nn]>=0,`page ${n} row [${tag}]: ${nn} is negative (${v[nn]})`);
      for(const t of solve){
        const key=t==='r2'?'bc':t;
        ok(kind.fields.includes(key)&&v[key]!=null,`page ${n} row [${tag}]: solve target "${t}" not derivable`);
      }
      if(kindName==='volume'&&!decimal&&(solve.includes('r')||solve.includes('r2')))
        ok(Number.isInteger(Math.sqrt(v.bc)),`page ${n} row [${tag}]: radius not a whole number (bc=${v.bc})`);
      for(const g of given)
        if(!g.bad) ok(cells.includes(g.raw),`page ${n} row [${tag}]: declared given ${g.k}=${g.raw} not visible in row cells`);
    }
  }
  perPage[n]=count;
}
for(const [n,exp] of Object.entries(expectedRows))
  ok(perPage[n]===exp,`page ${n}: expected ${exp} §12 completion rows, found ${perPage[n]||0}`);
const expectedTotal=Object.values(expectedRows).reduce((a,b)=>a+b,0);
ok(solvedRows===expectedTotal,`§12 re-solver: expected ${expectedTotal} completion rows total, re-solved ${solvedRows}`);
// ------------------------------------------------------------------------------------

for(const [n,text] of pages){
  ok(/<html lang="he" dir="rtl">/.test(text),`page ${n}: Hebrew RTL root missing`);
  ok(text.includes(`aria-label="עמוד ${n}"`),`page ${n}: page-number label missing`);
  ok(!text.includes('π = 3.14'),`page ${n}: forbidden exact equality π = 3.14`);
}

if(failures.length){
  console.error(`VOLUME QA FAILED (${failures.length})`);
  failures.forEach((f,i)=>console.error(`${i+1}. ${f}`));
  process.exit(1);
}
console.log('VOLUME QA PASS: pages 25-38 verify V=B·h→V=πr²h progression, radius/diameter, decimals, unit conversion, exact/approx π, capacity, direct and inverse height/base/radius calculations; §12 completion tables (25/26/27/28/29/30/32/33/34/35/36/37) are re-solved from declared inputs — 47 rows across three kinds (cylinder π-coefficient, literal base·height, capacity-remaining), each uniquely solvable and consistent, with integer class-8 results where exact and decimal/approx/capacity rows allowed, and every declared given matched to the printed cells.');
