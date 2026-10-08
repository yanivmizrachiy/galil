import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const TRACKER='workplans/galil.json';
const file = new URL('../workplans/galil.json', import.meta.url);
const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
const failures=[];
const fail=(msg)=>failures.push(msg);

if (!Array.isArray(plan.tasks) || plan.tasks.length === 0) fail('tasks missing');
const weightTotal = plan.tasks.reduce((sum, t) => sum + t.weight, 0);
if (weightTotal !== 100) fail(`task weights total ${weightTotal}, expected 100`);

for (const task of plan.tasks) {
  if (!task.id || !task.title) fail('task identity missing');
  if (!Number.isFinite(task.percent) || task.percent < 0 || task.percent > 100) fail(`${task.id}: invalid percent`);
  if (!['pending', 'in_progress', 'blocked', 'done'].includes(task.status)) fail(`${task.id}: invalid status`);
  if (task.percent > 0 && (!Array.isArray(task.evidence) || task.evidence.length === 0)) fail(`${task.id}: progress without evidence`);
  if (task.status === 'done' && task.percent !== 100) fail(`${task.id}: done must equal 100`);
  if (task.status === 'pending' && task.percent !== 0) fail(`${task.id}: pending must equal 0`);
}

const calculated = Math.round(plan.tasks.reduce((sum, t) => sum + (t.weight * t.percent / 100), 0));
if (plan.progress.overallProgressPercent !== calculated) fail(`overallProgressPercent must be ${calculated}`);
if (plan.progress.remainingPercent !== 100 - calculated) fail(`remainingPercent must be ${100 - calculated}`);
if (plan.progress.totalTasks !== plan.tasks.length) fail('totalTasks mismatch');
const blocked = plan.tasks.filter(t => t.status === 'blocked').length;
if (plan.progress.blockedCount !== blocked) fail('blockedCount mismatch');
if (calculated === 100 && plan.tasks.some(t => t.status !== 'done')) fail('100% requires every task done');

const meaningful=(file)=>[
  /^SOURCE_OF_TRUTH\.md$/,
  /^page-\d+\.html$/,
  /^index\.html$/,
  /^styles\.css$/,
  /^qa\.mjs$/,
  /^ssot-qa\.mjs$/,
  /^scripts\/(?!verify-progress\.mjs$)/,
  /^assets\//,
  /^provenance\//
].some(rx=>rx.test(file));

function git(args){
  return execFileSync('git',args,{encoding:'utf8',maxBuffer:20*1024*1024}).trim();
}
function changedFiles(base,head='HEAD'){
  if(base && !/^0+$/.test(base)){
    return git(['diff','--name-only',base,head]).split(/\r?\n/).filter(Boolean);
  }
  const changed=git(['diff','--name-only','HEAD']).split(/\r?\n/).filter(Boolean);
  const untracked=git(['ls-files','--others','--exclude-standard']).split(/\r?\n/).filter(Boolean);
  return [...new Set([...changed,...untracked])];
}

try{
  const [baseArg,headArg='HEAD']=process.argv.slice(2);
  const changed=changedFiles(baseArg,headArg);
  const projectChanged=changed.some(meaningful);
  const trackerChanged=changed.includes(TRACKER);
  if(projectChanged&&!trackerChanged){
    fail(`meaningful Galil change without ${TRACKER} in the same work cycle/change`);
  }
}catch(error){
  fail(`unable to verify progress coupling: ${error.message}`);
}

if(failures.length){
  console.error(`GALIL PROGRESS FAILED (${failures.length})`);
  for(const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`Galil progress verified: ${calculated}% complete, ${100 - calculated}% remaining, ${blocked} blocked; tracker coupling enforced.`);
