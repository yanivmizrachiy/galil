import fs from 'node:fs';

const file = new URL('../workplans/galil.json', import.meta.url);
const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = (msg) => { throw new Error(`Progress verification failed: ${msg}`); };

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

console.log(`Galil progress verified: ${calculated}% complete, ${100 - calculated}% remaining, ${blocked} blocked.`);
