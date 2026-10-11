// Regression tests for real governance failures (§1/§20/§21), in a disposable Git fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'galil-governance-'));
let cases = 0;

function run(command, args, cwd = fixture) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.error, undefined, `${command}: ${result.error?.message}`);
  assert.notEqual(result.status, null, `${command}: killed by ${result.signal}`);
  return result;
}
const git = args => {
  const result = run('git', args);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
function pass(script, args = []) {
  const result = run(process.execPath, [script, ...args]);
  assert.equal(result.status, 0, result.stderr);
  cases++;
}
function reject(script, message, args = []) {
  const result = run(process.execPath, [script, ...args]);
  assert.notEqual(result.status, 0, `expected ${script} to reject a fixture`);
  assert.match(result.stderr, message);
  cases++;
}
function withFile(relative, content, test) {
  const file = path.join(fixture, relative);
  const original = fs.existsSync(file) ? fs.readFileSync(file) : null;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  try { test(); } finally {
    if (original === null) fs.rmSync(file); else fs.writeFileSync(file, original);
  }
}
function trackerMutation(mutate, test) {
  const relative = 'workplans/galil.json';
  const tracker = JSON.parse(fs.readFileSync(path.join(fixture, relative), 'utf8'));
  mutate(tracker);
  withFile(relative, JSON.stringify(tracker, null, 2) + '\n', test);
}

try {
  const listing = run('git', ['ls-files', '--cached', '--others', '--exclude-standard'], root);
  assert.equal(listing.status, 0, listing.stderr);
  for (const relative of listing.stdout.trim().split(/\r?\n/).filter(Boolean)) {
    const target = path.join(fixture, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, relative), target);
  }
  pass('ssot-qa.mjs');
  for (const level of [1, 2, 6]) {
    withFile('notes/authority.md', '#'.repeat(level) + ' מקור האמת היחיד — מתחרה\n', () =>
      reject('ssot-qa.mjs', /declares a competing source of truth/));
  }
  withFile('notes/authority.md', 'זהו קובץ ההוראות והדרישות המחייב היחיד\n', () =>
    reject('ssot-qa.mjs', /competing requirements authority/));
  withFile('notes/RULES.md', 'Alternative rules\n', () =>
    reject('ssot-qa.mjs', /competing requirements document/));
  withFile('evidence.json', JSON.stringify({ canonicalSourceOfTruth: 'OTHER.md' }), () =>
    reject('ssot-qa.mjs', /points to a different source of truth/));
  withFile('notes/evidence.md', '# Evidence\nSee SOURCE_OF_TRUTH.md.\n', () => pass('ssot-qa.mjs'));

  pass('coverage-qa.mjs');
  withFile('SOURCE_OF_TRUTH.md', fs.readFileSync(path.join(fixture, 'SOURCE_OF_TRUTH.md'), 'utf8') + '\nChanged requirement.\n', () =>
    reject('coverage-qa.mjs', /coverage is stale/));
  trackerMutation(tracker => tracker.requirementsCoverage.sections.pop(), () =>
    reject('coverage-qa.mjs', /map every source section once/));
  trackerMutation(tracker => tracker.requirementsCoverage.sections[0].checks.push('missing-qa.mjs'), () =>
    reject('coverage-qa.mjs', /check paths invalid/));
  trackerMutation(tracker => tracker.requirementsCoverage.sections[0].checks.push('scripts'), () =>
    reject('coverage-qa.mjs', /check paths invalid/));
  trackerMutation(tracker => { tracker.requirementsCoverage.sections[0].pendingManual = [' ']; }, () =>
    reject('coverage-qa.mjs', /manual-review list missing or invalid/));
  trackerMutation(tracker => delete tracker.tasks[0].acceptanceCriteria, () =>
    reject('coverage-qa.mjs', /acceptance references missing/));
  trackerMutation(tracker => { tracker.tasks[0].acceptanceCriteria = [null]; }, () =>
    reject('coverage-qa.mjs', /invalid acceptance criterion/));

  git(['init', '-q']);
  git(['add', '.']);
  const commit = message => git(['-c', 'user.name=Galil QA', '-c', 'user.email=qa@example.invalid', 'commit', '-qm', message]);
  commit('fixture baseline');
  pass('scripts/verify-progress.mjs');
  const paths = ['reader-qa.mjs', 'workspace-grid-qa.mjs', 'coverage-qa.mjs', 'governance-qa.mjs',
    'scripts/verify-progress.mjs', '.github/workflows/progress-guard.yml', '.github/workflows/qa.yml',
    'README.md', 'CLAUDE.md', 'PROVENANCE.md', 'galil-student.pdf.manifest.json', 'index.html', 'page-1.html'];
  for (const relative of paths) {
    const original = fs.readFileSync(path.join(fixture, relative));
    withFile(relative, Buffer.concat([original, Buffer.from('\n')]), () =>
      reject('scripts/verify-progress.mjs', /meaningful Galil change without workplans\/galil\.json/));
  }
  withFile('vendor/audit-fixture.txt', 'changed rendering input\n', () =>
    reject('scripts/verify-progress.mjs', /meaningful Galil change without workplans\/galil\.json/));
  trackerMutation(tracker => delete tracker.tasks[0].acceptanceCriteria, () =>
    reject('scripts/verify-progress.mjs', /done requires acceptance criteria/));
  const allDone = tracker => {
    for (const task of tracker.tasks) { task.status = 'done'; task.percent = 100; }
    tracker.progress.overallProgressPercent = 100;
    tracker.progress.remainingPercent = 0;
    tracker.progress.blockedCount = 0;
  };
  trackerMutation(tracker => {
    allDone(tracker);
    tracker.closure ||= {};
    delete tracker.closure.specificationClosed;
  }, () => reject('scripts/verify-progress.mjs', /100% requires recorded specification closure/));
  trackerMutation(tracker => {
    allDone(tracker);
    tracker.closure ||= {};
    tracker.closure.specificationClosed = true;
    delete tracker.closure.finalDispositionApproved;
  }, () => reject('scripts/verify-progress.mjs', /100% requires approved final page disposition/));
  trackerMutation(tracker => {
    allDone(tracker);
    tracker.closure ||= {};
    tracker.closure.specificationClosed = true;
    tracker.closure.finalDispositionApproved = true;
    delete tracker.closure.evidence;
  }, () => reject('scripts/verify-progress.mjs', /100% requires closure evidence/));
  trackerMutation(tracker => {
    allDone(tracker);
    tracker.closure.specificationClosed = true;
    tracker.closure.finalDispositionApproved = true;
    tracker.closure.evidence = ['Synthetic authorized closure in a disposable test fixture only.'];
  }, () => pass('scripts/verify-progress.mjs'));
  withFile('reader-qa.mjs', fs.readFileSync(path.join(fixture, 'reader-qa.mjs'), 'utf8') + '\n', () =>
    trackerMutation(tracker => { tracker.updatedBy = 'fixture update'; }, () => pass('scripts/verify-progress.mjs')));

  const baseline = git(['rev-parse', 'HEAD']);
  fs.appendFileSync(path.join(fixture, 'reader-qa.mjs'), '\n');
  git(['add', 'reader-qa.mjs']);
  reject('scripts/verify-progress.mjs', /meaningful Galil change without workplans\/galil\.json/);
  commit('uncoupled QA change');
  reject('scripts/verify-progress.mjs', /meaningful Galil change without workplans\/galil\.json/, [baseline, 'HEAD']);
  const trackerFile = path.join(fixture, 'workplans/galil.json');
  const tracker = JSON.parse(fs.readFileSync(trackerFile, 'utf8'));
  tracker.updatedBy = 'fixture coupled change';
  fs.writeFileSync(trackerFile, JSON.stringify(tracker, null, 2) + '\n');
  git(['add', 'workplans/galil.json']);
  commit('tracker evidence update');
  pass('scripts/verify-progress.mjs', [baseline, 'HEAD']);
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
console.log(`GOVERNANCE QA PASS: ${cases} positive/negative cases; Hebrew authority, source-map staleness, acceptance references and working/staged/committed tracker coupling protected; fixture removed.`);
