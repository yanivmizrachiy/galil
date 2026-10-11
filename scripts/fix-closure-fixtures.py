from pathlib import Path

# Make governance negative fixtures independent of whether the real baseline is 98% or an authorized 100%.
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

# The cover is screen-only too, so print CSS legitimately groups .intro-video with .cover-preview.
# Keep the behavior requirement (video hidden in print) while avoiding a selector-shape false failure.
p=Path('reader-qa.mjs')
s=p.read_text(encoding='utf-8')
old="ok(/\\.intro-video\\{display:none\\}/.test(html), 'intro video must be hidden in print');"
new="ok(/@media print\\{[^}]*\\.intro-video[^}]*\\{display:none\\}/.test(html), 'intro video must be hidden in print');"
if old not in s:
    raise SystemExit('expected reader print-video assertion not found')
p.write_text(s.replace(old,new,1),encoding='utf-8')
print('reader print QA now accepts grouped selectors while still requiring intro-video display:none')
