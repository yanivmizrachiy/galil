// Derived traceability gate (SOURCE_OF_TRUTH.md §20–21); mapping is not completion approval.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(root, 'SOURCE_OF_TRUTH.md'), 'utf8');
const tracker = JSON.parse(fs.readFileSync(path.join(root, 'workplans/galil.json'), 'utf8'));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const digest = text => crypto.createHash('sha256').update(text).digest('hex');
const headings = [...source.matchAll(/^## (\d+)\. (.+)$/gm)];
const expected = headings.map((heading, i) => ({
  section: Number(heading[1]),
  heading: heading[2],
  digest: digest(source.slice(heading.index, headings[i + 1]?.index ?? source.length))
}));
const coverage = tracker.requirementsCoverage;
check(coverage?.source === 'SOURCE_OF_TRUTH.md', 'coverage must refer to SOURCE_OF_TRUTH.md');
check(coverage?.sourceSha256 === digest(source), 'coverage is stale: the source changed; review its mapping');
check(coverage?.isCompletionApproval === false, 'coverage must not claim completion approval');
const entries = Array.isArray(coverage?.sections) ? coverage.sections : [];
check(JSON.stringify(entries.map(row => row.section)) === JSON.stringify(expected.map(row => row.section)), 'coverage must map every source section once, in source order');
const statuses = ['automated', 'partial', 'manual', 'reserved'];
const nonemptyText = value => typeof value === 'string' && value.trim().length > 0;
const safeFile = relative => {
  if (!nonemptyText(relative) || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) return false;
  try { return fs.statSync(path.join(root, relative)).isFile(); } catch { return false; }
};
for (const section of expected) {
  const row = entries.find(row => row.section === section.section);
  if (!row) continue;
  check(row.sourceHeading === section.heading, `§${section.section}: source heading drift`);
  check(row.sourceSha256 === section.digest, `§${section.section}: source section changed since its mapping review`);
  check(statuses.includes(row.coverage), `§${section.section}: invalid coverage classification`);
  check(Array.isArray(row.implementation) && row.implementation.length > 0 && row.implementation.every(safeFile), `§${section.section}: implementation paths missing or invalid`);
  check(Array.isArray(row.checks) && row.checks.every(safeFile), `§${section.section}: check paths invalid`);
  check(Array.isArray(row.pendingManual) && row.pendingManual.every(nonemptyText), `§${section.section}: manual-review list missing or invalid`);
  if (row.coverage === 'automated') check(Array.isArray(row.checks) && row.checks.length > 0 && Array.isArray(row.pendingManual) && row.pendingManual.length === 0, `§${section.section}: automated coverage needs checks and no unverified manual claim`);
  else check(row.pendingManual?.length > 0, `§${section.section}: partial/manual/reserved coverage must name what remains`);
}

for (const task of tracker.tasks) {
  const acceptance = task.acceptanceCriteria;
  check(Array.isArray(acceptance) && acceptance.length > 0, `${task.id}: acceptance references missing`);
  for (const criterion of Array.isArray(acceptance) ? acceptance : []) {
    if (!criterion || typeof criterion !== 'object') {
      check(false, `${task.id}: invalid acceptance criterion`);
      continue;
    }
    check(Array.isArray(criterion.sourceSections) && criterion.sourceSections.length > 0 && criterion.sourceSections.every(n => expected.some(s => s.section === n)), `${task.id}: invalid acceptance source sections`);
    check(Array.isArray(criterion.checks) && criterion.checks.length > 0 && criterion.checks.every(safeFile), `${task.id}: acceptance checks missing or invalid`);
  }
}

if (failures.length) {
  console.error(`COVERAGE QA FAILED (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
const manual = entries.filter(row => row.coverage !== 'automated').length;
console.log(`COVERAGE QA PASS: ${entries.length} source sections mapped to existing implementation/check files; ${manual} explicitly retain manual or reserved review. This is traceability, not a completion certificate.`);
