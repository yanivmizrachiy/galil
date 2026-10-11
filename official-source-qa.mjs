import fs from 'node:fs';

const file = new URL('./official-questions-source.json', import.meta.url);
const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
const failures=[];
const ok=(cond,msg)=>{if(!cond)failures.push(msg)};

ok(snapshot?.source?.repository==='yanivmizrachiy/jerusalem2','official source repository drift');
ok(snapshot?.source?.path==='src/content/curriculum-fragments/idkun-geometri-8/idkun-geometri-8-p001-025.json','official source path drift');
ok(snapshot?.source?.blobSha==='64406e6f6615fe798aa5bea3799270b4d8ae5c80','official source blob SHA drift');
ok(JSON.stringify(snapshot?.source?.relevantPages)==='[14,15,16,19]','official source page mapping drift');
ok(JSON.stringify(snapshot?.mapping?.cylinderQuestionsInOrder)==='[1,2,3,4,5,7]','official Galil question order must be 1,2,3,4,5,7');
ok(snapshot?.mapping?.excludedQuestion===6,'official question 6 must remain excluded from Galil because it is the cone item');

const questions=Array.isArray(snapshot.questions)?snapshot.questions:[];
const ids=questions.map(q=>q.id);
ok(JSON.stringify(ids)==='[1,2,3,4,5,7]','snapshot question inventory must contain exactly 1,2,3,4,5,7 in order');
ok(!ids.includes(6),'cone question 6 must not enter the Galil official-question snapshot');

const byId=new Map(questions.map(q=>[q.id,q]));
for(const id of [1,2,3,4,5,7]){
  const q=byId.get(id);
  ok(Boolean(q),`question ${id}: missing source snapshot`);
  ok(typeof q?.rawTranscription==='string'&&q.rawTranscription.trim().length>40,`question ${id}: raw transcription missing/too short`);
  ok(['text_locked_diagram_pending','text_locked_diagram_verified','text_locked_no_diagram_dependency'].includes(q?.renderingStatus),`question ${id}: invalid rendering status`);
  // A diagram-dependent question may only be marked verified when real, pinned visual evidence is recorded.
  if(q?.renderingStatus==='text_locked_diagram_verified'){
    const ev=snapshot?.diagramEvidence;
    ok(q.diagramRequired===true,`question ${id}: only diagram-dependent questions can be diagram_verified`);
    ok(ev?.scanSource?.commit==='45a6024f2448417f42114caa866006d1942cb714',`question ${id}: diagram evidence must be pinned to the jerusalem2 scan commit`);
    ok(/^[0-9a-f]{64}$/.test(ev?.scanSha256?.['page-014.webp']||'')&&/^[0-9a-f]{64}$/.test(ev?.scanSha256?.['page-015.webp']||'')&&/^[0-9a-f]{64}$/.test(ev?.scanSha256?.['page-016.webp']||''),`question ${id}: diagram evidence must record the sha256 of the pinned source scans`);
    ok(typeof ev?.findings?.[String(id)]==='string'&&ev.findings[String(id)].length>40,`question ${id}: diagram evidence must record a per-question finding`);
  }
}

ok(byId.get(1)?.diagramRequired===true,'question 1: source diagram dependency must remain explicit');
ok(byId.get(3)?.diagramRequired===true,'question 3: source diagram dependency must remain explicit');
ok(byId.get(4)?.diagramRequired===true,'question 4: source diagram dependency must remain explicit');
ok(byId.get(2)?.diagramRequired===false&&byId.get(5)?.diagramRequired===false&&byId.get(7)?.diagramRequired===false,'questions 2,5,7: no diagram dependency expected from current source transcription');

ok(byId.get(1)?.rawTranscription.includes('שטח ABCD הוא 60 סמ״ר'),'question 1: ABCD=60 source datum missing');
ok(byId.get(1)?.rawTranscription.includes('3 ס״מ = r')&&byId.get(1)?.rawTranscription.includes('8 ס״מ = h')&&byId.get(1)?.rawTranscription.includes('5 ס״מ = r'),'question 1: canonical numeric data drift');
ok(byId.get(2)?.rawTranscription.includes('1000 סמ״ר')&&byId.get(2)?.rawTranscription.includes('20 ס״מ')&&byId.get(2)?.rawTranscription.includes('4 ליטרים'),'question 2: canonical numeric data drift');
ok(byId.get(3)?.rawTranscription.includes('גליל בתוך תיבה')&&byId.get(3)?.rawTranscription.includes('תיבה ריבועית בתוך גליל')&&byId.get(3)?.rawTranscription.includes('שאורך צלעו 8 ס״מ'),'question 3: two-tool source wording/data drift');
ok(byId.get(4)?.rawTranscription.includes('נתונים 4 גלילים שמידותיהם שוות')&&byId.get(4)?.rawTranscription.includes('4 ס״מ = r')&&byId.get(4)?.rawTranscription.includes('10 ס״מ = h'),'question 4: four-cylinder source wording/data drift');
ok(byId.get(5)?.rawTranscription.includes('מחירה של הצנצנת הגבוהה הוא 13 שקלים')&&byId.get(5)?.rawTranscription.includes('מחירה של הצנצנת הנמוכה הוא 20 שקלים'),'question 5: honey-price source data drift');
ok(byId.get(7)?.rawTranscription.includes('30 ס״מ')&&byId.get(7)?.rawTranscription.includes('21 ס״מ')&&byId.get(7)?.rawTranscription.includes('מגלגלים את הדף למעטפת גליל'),'question 7: paper-roll source wording/data drift');

ok(snapshot?.policy?.doNotNormalizeSuspectedSourceErrorsWithoutVisualVerification===true,'source-error normalization guard must stay enabled');
ok(snapshot?.policy?.doNotRenderDiagramDependentQuestionsAsFinalUntilDiagramVerified===true,'diagram verification guard must stay enabled');
ok(snapshot?.policy?.question6MustNotAppearInGalilOfficialQuestionSet===true,'question-6 exclusion guard must stay enabled');

if(failures.length){
  console.error(`OFFICIAL SOURCE QA FAILED (${failures.length})`);
  failures.forEach((f,i)=>console.error(`${i+1}. ${f}`));
  process.exit(1);
}

const pending=questions.filter(q=>q.renderingStatus==='text_locked_diagram_pending').map(q=>q.id);
console.log(`OFFICIAL SOURCE QA PASS: canonical jerusalem2 blob locked; Galil questions 1-5 and 7 mapped in order; cone question 6 excluded; diagram-dependent items ${pending.length?`still pending visual verification: ${pending.join(',')}`:'all visually verified against the pinned jerusalem2 scans (evidence recorded in official-questions-source.json)'}.`);
