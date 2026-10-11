from pathlib import Path
p=Path('governance-qa.mjs')
s=p.read_text(encoding='utf-8')
old="""  trackerMutation(allDone, () => reject('scripts/verify-progress.mjs', /100% requires recorded specification closure/));
  trackerMutation(tracker => { allDone(tracker); tracker.closure.specificationClosed = true; }, () =>
    reject('scripts/verify-progress.mjs', /100% requires approved final page disposition/));
  trackerMutation(tracker => { allDone(tracker); tracker.closure.specificationClosed = true; tracker.closure.finalDispositionApproved = true; }, () =>
    reject('scripts/verify-progress.mjs', /100% requires closure evidence/));
"""
new="""  trackerMutation(tracker => {
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
"""
if old not in s:
    raise SystemExit('expected governance closure fixture block not found')
p.write_text(s.replace(old,new,1),encoding='utf-8')
print('governance negative closure fixtures now clear inherited authorization explicitly')
