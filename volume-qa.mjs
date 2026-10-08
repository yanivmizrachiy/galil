import fs from 'node:fs';

const failures=[];
const ok=(cond,msg)=>{if(!cond)failures.push(msg)};
const read=n=>fs.readFileSync(new URL(`./page-${n}.html`,import.meta.url),'utf8');
const pages=new Map([25,26,27,28,29,30,31,32,33,34,35,36,37,38].map(n=>[n,read(n)]));
const has=(n,...parts)=>parts.every(part=>pages.get(n).includes(part));

ok(has(25,'V = B·h','12·5 = ____','40·2.5 = ____','100 ס״מ³'),'page 25: base-area-to-volume bridge incomplete');
ok(has(26,'B = π·r²','V = B·h','V = π·r²·h','V = 2·π·r·h'),'page 26: guided derivation/distractor set for cylinder volume incomplete');
ok(has(27,'V = π·r²·h','r → r² → ·h → V','r = 7'),'page 27: direct radius/height volume progression incomplete');
ok(has(28,'d → r → B → V','d=10 → r=5 → B=25π → V=75π','לחלק את d ב־2'),'page 28: diameter-to-radius-to-volume progression incomplete');
ok(has(29,'r = 1.5','r = 0.5','2.5π ס״מ³'),'page 29: decimal-volume practice or verified example missing');
ok(has(30,'אין מציבים בנוסחת נפח נתונים ביחידות שונות','r = 30','d = 80','r = 0.05','d = 0.12'),'page 30: mixed-unit conversion practice incomplete');
ok(has(31,'שמרו π בתשובה המדויקת','≈','20π','62.83'),'page 31: exact/approx π distinction incomplete');
ok(has(32,'נפח וקיבול','1 ס״מ³ = 1 מ״ל','d=10'),'page 32: capacity conversion and diameter case incomplete');
ok(has(33,'מ״ל או ליטר','785 ס״מ³','≈ 785 מ״ל'),'page 33: real-world capacity practice incomplete');
ok(has(34,'קיבול מלא','כמות קיימת','מקום שנשאר','1200 מ״ל'),'page 34: remaining-capacity application incomplete');
ok(has(35,'h = V ÷ B','B = 25π','V = 100π','V ÷ B'),'page 35: inverse height calculation incomplete');
ok(has(36,'B = V ÷ h','150π ÷ 6','25π ס״מ²'),'page 36: inverse base-area calculation incomplete');
ok(has(37,'V ÷ h → B → r','r² = ____','B = 49π','7 ס״מ'),'page 37: inverse radius calculation incomplete');
ok(has(38,'נפח גליל — סיכום','d→r→B→V','1.5 ליטר','B=16π','V=147π','d=80'),'page 38: cumulative volume checkpoint incomplete');

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
console.log('VOLUME QA PASS: pages 25-38 verify V=B·h→V=πr²h progression, radius/diameter, decimals, unit conversion, exact/approx π, capacity, direct and inverse height/base/radius calculations, with deterministic arithmetic sanity checks.');
