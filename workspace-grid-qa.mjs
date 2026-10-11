import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const css=read('./styles.css');
const ssot=read('./SOURCE_OF_TRUTH.md');
const failures=[];
const ok=(condition,message)=>{if(!condition)failures.push(message)};

// Presentation-only contract: this gate must never require wording/page-content
// changes. It protects the SSOT student workspace format while leaving Claude's
// question logic, page structure and official-source locks untouched.
ok(ssot.includes('שאלה → מקום עבודה/משבצות → תשובה'),'SSOT §16 preferred question → workspace/grid → answer structure missing');
ok(ssot.includes('משבצות עבודה צריכות להיות קריאות ולהישמר גם ב־PDF'),'SSOT §16 grid-preservation requirement missing');
ok((css.match(/background-size:5mm 5mm/g)||[]).length>=2,'both explicit and automatic calculation workspaces must use a 5×5 mm grid');
ok(css.includes('.work{')&&css.includes('linear-gradient(to right')&&css.includes('linear-gradient(to bottom'),'shared .work component must render a two-axis square grid');
ok(css.includes('.task:last-of-type .task-body::after')&&css.includes('background-image:linear-gradient(to right'),'automatic A4-filling computational workspace must render the same square grid');
ok(!css.includes('background:repeating-linear-gradient(to bottom'),'ruled-line-only calculation workspace must not remain');
ok(!css.includes('lined work area'),'CSS documentation must not describe student workspaces as lined');

if(failures.length){
  console.error('WORKSPACE GRID QA FAIL');
  failures.forEach((failure,index)=>console.error(`${index+1}. ${failure}`));
  process.exit(1);
}
console.log('WORKSPACE GRID QA PASS: Galil computational workspaces use readable 5×5 mm square grids and preserve the SSOT structure.');
