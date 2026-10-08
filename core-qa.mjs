import fs from 'node:fs';

const failures=[];
const ok=(cond,msg)=>{if(!cond)failures.push(msg)};
const read=n=>fs.readFileSync(new URL(`./page-${n}.html`,import.meta.url),'utf8');
const p={};
for(let n=1;n<=8;n++)p[n]=read(n);

const has=(n,...parts)=>parts.every(part=>p[n].includes(part));

ok(has(1,'מושגים בסיסיים','גליל','גוף תלת־ממדי'),'page 1: 2D/3D prerequisite and cylinder example missing');
ok(has(2,'מזהים גליל','שני בסיסים עגולים חופפים','מישורים מקבילים'),'page 2: cylinder identification definition incomplete');
ok(has(2,'גליל שוכב','גליל גבוה וצר','גליל נמוך ורחב'),'page 2: orientation/shape variation insufficient');
ok(has(3,'שני בסיסים','שני הבסיסים חופפים','מישורים מקבילים'),'page 3: base congruence/parallel-plane practice missing');
ok(has(4,'מעטפת הגליל','המשטח הצדדי שמחבר בין שני הבסיסים'),'page 4: lateral-surface concept missing');
ok(has(5,'רדיוס וקוטר בבסיס','d = 2·r','d = 10','r = 3.5'),'page 5: radius/diameter relation or bidirectional practice missing');
ok(has(6,'גובה הגליל','המרחק המאונך בין מישורי שני הבסיסים','גליל שוכב','גליל מסובב'),'page 6: height definition/orientation practice missing');
ok(has(6,'בגליל ישר הגובה מאונך למישורי הבסיסים','כיוון הדף קובע מהו גובה הגליל'),'page 6: height misconception checks missing');
ok(has(7,'לא מודדים מן המראה של הציור','רדיוס 3 סנטימטר','גובה 8 סנטימטר','קוטר הבסיס הוא 6'),'page 7: perspective-data discipline missing');
ok(has(8,'זיהוי גוף, בסיסים, מעטפת, רדיוס, קוטר וגובה','r = 4','d = 18','גובה הגליל מאונך'),'page 8: foundational checkpoint coverage missing');

const headings=[...Array(8)].map((_,i)=>p[i+1].match(/<h1 class="page-title">([^<]+)<\/h1>/)?.[1]||'');
ok(new Set(headings).size===8,'pages 1-8: duplicate foundational page headings');
for(let n=1;n<=8;n++){
  ok(/<html lang="he" dir="rtl">/.test(p[n]),`page ${n}: Hebrew RTL root missing`);
  ok(p[n].includes(`aria-label="עמוד ${n}"`),`page ${n}: stable page-number label missing`);
}

if(failures.length){
  console.error(`CORE CONCEPT QA FAILED (${failures.length})`);
  failures.forEach((f,i)=>console.error(`${i+1}. ${f}`));
  process.exit(1);
}
console.log('CORE CONCEPT QA PASS: pages 1-8 verify cylinder recognition, two congruent parallel circular bases, lateral surface, radius/diameter, perpendicular height, orientation independence, perspective-data discipline and checkpoint coverage.');
