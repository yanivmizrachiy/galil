import fs from 'node:fs';

const failures=[];
const ok=(cond,msg)=>{if(!cond)failures.push(msg)};
const snapshot=JSON.parse(fs.readFileSync(new URL('./official-questions-source.json',import.meta.url),'utf8'));
const mapping=[
  {page:44,q:1},
  {page:45,q:2},
  {page:46,q:3},
  {page:47,q:4},
  {page:48,q:5},
  {page:49,q:7}
];
const read=p=>fs.readFileSync(new URL(`./page-${p}.html`,import.meta.url),'utf8');
const textByPage=new Map(mapping.map(({page})=>[page,read(page)]));

ok(JSON.stringify(snapshot.mapping.cylinderQuestionsInOrder)==='[1,2,3,4,5,7]','source snapshot official order drift');

for(const {page,q} of mapping){
  const html=textByPage.get(page);
  ok(html.includes('data-official="curriculum"'),`page ${page}: official curriculum marker missing`);
  ok(html.includes(`data-official-question="${q}"`),`page ${page}: official question id ${q} missing`);
  ok(html.includes('שאלות מתוך תוכנית הלימודים'),`page ${page}: official heading missing`);
  ok(html.includes(`aria-label="עמוד ${page}"`),`page ${page}: page number label missing`);
  ok(/class="work h\d+"/.test(html),`page ${page}: student workspace missing`);
  ok(/class="answer"/.test(html),`page ${page}: answer line missing`);
  ok(!html.includes('data-official-question="6"'),`page ${page}: cone question 6 must never be rendered in Galil`);
}

// Question 1 (page 44): exact current-source data distribution verified against the source text+diagram evidence.
const p44=textByPage.get(44);
ok(p44.includes('חשבו את נפח הגלילים ושטחי המעטפת שלהם על פי הנתונים:'),'page 44/Q1: official instruction missing');
ok(p44.includes('r = 3')&&p44.includes('h = 8'),'page 44/Q1(a): r=3,h=8 data missing');
ok(p44.includes('שטח <span dir="ltr">ABCD</span> הוא 60 סמ״ר')&&p44.includes('r = 5'),'page 44/Q1(b): ABCD=60,r=5 data missing');
ok((p44.match(/<svg\b/g)||[]).length>=2,'page 44/Q1: two source-dependent cylinder diagrams required');

const p45=textByPage.get(45);
ok(p45.includes('שטח הבסיס שלו הוא 1000 סמ״ר וגובהו 20 ס״מ'),'page 45/Q2: base area/height wording drift');
ok(p45.includes('ממלאים את הגליל ב- 4 ליטרים של מים'),'page 45/Q2: 4-liter datum missing');
ok(p45.includes('מה יהיה גובה פני המים לאחר המילוי?'),'page 45/Q2: final question wording missing');

const p46=textByPage.get(46);
ok(p46.includes('נתונים שני כלים.'),'page 46/Q3: opening wording missing');
ok(p46.includes('גליל בתוך תיבה')&&p46.includes('r = 5')&&p46.includes('h = 12'),'page 46/Q3(I): data missing');
ok(p46.includes('תיבה ריבועית בתוך גליל')&&p46.includes('ABCD')&&p46.includes('צלעו 8 ס״מ'),'page 46/Q3(II): square-box data missing');
ok(p46.includes('חשבו את נפח הגליל ואת נפח התיבה של כל אחד מהכלים.'),'page 46/Q3: official calculation instruction missing');
ok((p46.match(/<svg\b/g)||[]).length>=2,'page 46/Q3: two source-dependent diagrams required');

const p47=textByPage.get(47);
ok(p47.includes('נתונים 4 גלילים שמידותיהם שוות.'),'page 47/Q4(a): opening wording missing');
ok(p47.includes('באיזה מהמשטחים של המשולשים הצלע המובלטת היא הקצרה ביותר? הארוכה ביותר? נמקו.'),'page 47/Q4(a): comparison wording missing');
ok(p47.includes('r = 4')&&p47.includes('h = 10'),'page 47/Q4(b): r=4,h=10 data missing');
ok(p47.includes('חשבו את נפח הגליל; חשבו את שטחי המשולשים, ואת אורך הצלע המובלטת בכל משולש.'),'page 47/Q4(b): calculation wording missing');
ok((p47.match(/<svg\b/g)||[]).length===4,'page 47/Q4: exactly four cylinder/triangle diagrams required');

const p48=textByPage.get(48);
for(const phrase of [
  'דרור רצה לקנות צנצנת דבש.',
  'צנצנת אחת הייתה גבוהה פי שניים מהשנייה, אבל קוטר בסיסה היה פי שניים קטן יותר.',
  'מחירה של הצנצנת הגבוהה הוא 13 שקלים ומחירה של הצנצנת הנמוכה הוא 20 שקלים.',
  'איזו צנצנת יבחר דרור, אם רצונו לקנות את הדבש במחיר הנמוך ביותר ליחידת נפח? הסבירו.'
]) ok(p48.includes(phrase),`page 48/Q5: missing official phrase: ${phrase}`);

const p49=textByPage.get(49);
ok(p49.includes('אורכו של דף נייר מלבני הוא 30 ס״מ, ורוחבו 21 ס״מ.'),'page 49/Q7: paper dimensions missing');
ok(p49.includes('מגלגלים את הדף למעטפת גליל, כך שרוחב הדף הוא בסיס הגליל.. מהו רדיוס הבסיס? מהו נפח הגליל?'),'page 49/Q7(a): current-source wording drift');
ok(p49.includes('מגלגלים את הדף למעטפת גליל, כך שאורך הדף הוא בסיס הגליל.. מהו רדיוס הבסיס? מהו נפח הגליל?'),'page 49/Q7(b): current-source wording drift');

const renderedQuestions=mapping.map(x=>x.q);
ok(JSON.stringify(renderedQuestions)==='[1,2,3,4,5,7]','rendered official question order drift');

if(failures.length){
  console.error(`OFFICIAL RENDER QA FAILED (${failures.length})`);
  failures.forEach((f,i)=>console.error(`${i+1}. ${f}`));
  process.exit(1);
}
console.log('OFFICIAL RENDER QA PASS: pages 44-49 render current Galil questions 1-5 and 7 in order, preserve canonical wording/data anchors, exclude cone question 6, and provide student work/answer space; diagram-dependent Q1/Q3/Q4 remain subject to visual-source fidelity review.');
