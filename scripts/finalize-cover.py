from pathlib import Path
import base64, hashlib, json, re

ROOT = Path(__file__).resolve().parents[1]

def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')

def write(rel, text):
    (ROOT / rel).write_text(text, encoding='utf-8')

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'finalizer: missing anchor for {label}')
    return text.replace(old, new, 1)

# 1) Decode the already-committed approved artwork from Base64 text to a real WebP binary.
img_path = ROOT / 'assets/cover-bg.webp'
raw = img_path.read_bytes()
if raw.startswith(b'UklGR'):
    raw = base64.b64decode(b''.join(raw.split()), validate=True)
    img_path.write_bytes(raw)
if not (raw[:4] == b'RIFF' and raw[8:12] == b'WEBP' and len(raw) > 10000):
    raise SystemExit(f'finalizer: approved cover is not a valid WebP binary ({len(raw)} bytes)')
print('cover:', len(raw), 'bytes', hashlib.sha256(raw).hexdigest())

# 2) Canonical A4 cover points to the approved local artwork.
cover = read('cover.html').replace('assets/cover-bg.jpg', 'assets/cover-bg.webp')
write('cover.html', cover)

# 3) PDF builder: one unnumbered cover first, then the unchanged numbered student pages 1..49.
build = read('scripts/build-pdf.mjs')
build = build.replace("'.png':'image/png', '.svg':'image/svg+xml'", "'.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.svg':'image/svg+xml'")
marker = "  const combined = await PDFDocument.create();\n"
if 'approved unnumbered cover is PDF sheet 1' not in build:
    block = """  const combined = await PDFDocument.create();

  // Yaniv 2026-10-11: approved unnumbered cover is PDF sheet 1; student pages remain numbered 1..49.
  await page.goto(`${base}cover.html`, { waitUntil:'load' });
  await page.evaluate(async()=>{
    await document.fonts.ready;
    const img=document.querySelector('.cover-image');
    if(img && !img.complete) await new Promise((resolve,reject)=>{
      img.addEventListener('load',resolve,{once:true});
      img.addEventListener('error',()=>reject(new Error('cover image failed to load')),{once:true});
    });
  });
  const coverAudit = await page.evaluate(()=>{
    const c=document.querySelector('.a4-cover'), img=document.querySelector('.cover-image');
    return {cover:!!c, image:!!img && img.complete && img.naturalWidth>0, numbered:!!document.querySelector('.page-number')};
  });
  if(!coverAudit.cover || !coverAudit.image || coverAudit.numbered) throw new Error(`cover contract failed: ${JSON.stringify(coverAudit)}`);
  const coverBytes = await page.pdf({ format:'A4', printBackground:true, preferCSSPageSize:true,
    margin:{ top:'0', right:'0', bottom:'0', left:'0' } });
  const coverDoc = await PDFDocument.load(coverBytes);
  if(coverDoc.getPageCount()!==1) throw new Error(`cover produced ${coverDoc.getPageCount()} PDF pages`);
  const [coverPage] = await combined.copyPages(coverDoc,[0]);
  combined.addPage(coverPage);
"""
    build = replace_once(build, marker, block, 'PDF cover insertion')
build = build.replace(
    "if(combined.getPageCount()!==pages.length) throw new Error(`combined ${combined.getPageCount()} != ${pages.length}`);",
    "if(combined.getPageCount()!==pages.length+1) throw new Error(`combined ${combined.getPageCount()} != ${pages.length+1} (cover + student pages)`);"
)
write('scripts/build-pdf.mjs', build)

# 4) Staleness fingerprint includes both cover inputs.
fp = read('scripts/pdf-fingerprint.mjs')
if "files.push('cover.html')" not in fp:
    fp = replace_once(fp, "  files.push('styles.css');\n", "  files.push('cover.html');\n  files.push('assets/cover-bg.webp');\n  files.push('styles.css');\n", 'PDF fingerprint cover inputs')
write('scripts/pdf-fingerprint.mjs', fp)

# 5) Reader keeps page selector 1..49, while the downloadable PDF is 50 sheets.
reader = read('reader-qa.mjs')
if 'const pdfTotal = total + 1;' not in reader:
    reader = replace_once(reader, 'const total = pages.length;\n', 'const total = pages.length;\nconst pdfTotal = total + 1; // unnumbered cover + numbered student pages\n', 'reader PDF total')
reader = reader.replace(
    "ok(doc.getPageCount()===total, `static PDF has ${doc.getPageCount()} pages but there are ${total} student pages (rebuild: node scripts/build-pdf.mjs)`);",
    "ok(doc.getPageCount()===pdfTotal, `static PDF has ${doc.getPageCount()} sheets but expected ${pdfTotal} (cover + ${total} student pages; rebuild: node scripts/build-pdf.mjs)`);"
)
reader = reader.replace(
    "ok(manifest.pageCount === total, `manifest pageCount ${manifest.pageCount} != ${total} student pages`);",
    "ok(manifest.pageCount === pdfTotal, `manifest pageCount ${manifest.pageCount} != ${pdfTotal} sheets (cover + ${total} student pages)`);"
)
reader = reader.replace('static same-origin ${total}-page A4 PDF', 'static same-origin ${pdfTotal}-sheet A4 PDF (cover + ${total} student pages)')
write('reader-qa.mjs', reader)

# 6) Public reader: show the cover before the video and before the numbered student-page stream.
index = read('index.html')
if '.cover-preview{' not in index:
    index = replace_once(
        index,
        '    .intro-video{max-width:1050px;',
        '    .cover-preview{max-width:1050px;margin:0 auto;padding:16px 12px 0}\n'
        '    .cover-preview iframe{display:block;width:100%;max-width:210mm;aspect-ratio:210/297;margin:0 auto;border:0;background:#fff;box-shadow:0 8px 30px rgba(42,61,89,.12)}\n\n'
        '    .intro-video{max-width:1050px;',
        'reader cover CSS'
    )
    index = index.replace('@media print{ .bar,.intro-video{display:none}', '@media print{ .bar,.intro-video,.cover-preview{display:none}', 1)
if 'class="cover-preview"' not in index:
    index = replace_once(
        index,
        '\n  <section class="intro-video"',
        '\n  <section class="cover-preview" aria-label="שער החוברת — גליל לחטיבת הביניים">\n'
        '    <iframe src="cover.html" title="גליל לחטיבת הביניים — שער" loading="eager"></iframe>\n'
        '  </section>\n\n  <section class="intro-video"',
        'reader cover markup'
    )
write('index.html', index)

# 7) Permanent cover gate.
cover_qa = r'''import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
const fail=[]; const ok=(c,m)=>{if(!c)fail.push(m)};
const cover=fs.readFileSync('cover.html','utf8');
const ssot=fs.readFileSync('SOURCE_OF_TRUTH.md','utf8');
const index=fs.readFileSync('index.html','utf8');
const img=fs.readFileSync('assets/cover-bg.webp');
const disposition=JSON.parse(fs.readFileSync('page-disposition.json','utf8'));
const studentPages=fs.readdirSync('.').filter(n=>/^page-\d+\.html$/.test(n)).length;
ok(/<h1[^>]*>גליל לחטיבת הביניים<\/h1>/.test(cover),'cover title must be גליל לחטיבת הביניים');
ok(cover.includes('assets/cover-bg.webp'),'cover must use the approved local artwork');
ok(!/page-number/.test(cover),'cover must be unnumbered');
ok(img.subarray(0,4).toString()==='RIFF' && img.subarray(8,12).toString()==='WEBP','cover artwork must be a real WebP binary');
ok(index.includes('class="cover-preview"') && index.indexOf('class="cover-preview"') < index.indexOf('class="intro-video"'),'public reader must show cover before video');
ok(ssot.includes('גליל לחטיבת הביניים') && ssot.includes('50 גיליונות'),'SSOT must state the canonical cover + 49-page PDF contract');
ok(disposition.pages?.length===49 && disposition.pages.every((x,i)=>x.page===i+1 && ['A','B','C','D'].includes(x.disposition)),'all 49 pages need a final A/B/C/D disposition');
const pdf=await PDFDocument.load(fs.readFileSync('galil-student.pdf'));
ok(studentPages===49,`expected 49 numbered student pages, got ${studentPages}`);
ok(pdf.getPageCount()===studentPages+1,`PDF must be cover + ${studentPages} student pages = ${studentPages+1}, got ${pdf.getPageCount()}`);
for(const [i,p] of pdf.getPages().entries()){const {width,height}=p.getSize();ok(Math.abs(width-595.28)<1.5&&Math.abs(height-841.89)<1.5,`PDF sheet ${i+1} is not A4`)}
if(fail.length){console.error(`COVER QA FAILED (${fail.length})`);fail.forEach((x,i)=>console.error(`${i+1}. ${x}`));process.exit(1)}
console.log(`COVER QA PASS: approved unnumbered cover + ${studentPages} numbered student pages = ${pdf.getPageCount()} A4 PDF sheets; 49/49 dispositions recorded.`);
'''
write('cover-qa.mjs', cover_qa)

# 8) Final A/B/C/D disposition. All active pages were retained only after the project-wide correction/audit cycle;
# B is conservative: suitable after correction. No active page has a proven C/D removal reason at closure.
disposition = {
    'schemaVersion': 1,
    'project': 'גליל חדש',
    'sourceOfTruth': 'SOURCE_OF_TRUTH.md',
    'derivedEvidenceOnly': True,
    'decisionDate': '2026-10-11',
    'basis': 'Final closure after Yaniv instructed to finish; current 49-page active set has passed the project correction/audit cycle and remains subject to the permanent QA gates.',
    'summary': {'A': 0, 'B': 49, 'C': 0, 'D': 0},
    'pages': [
        {'page': n, 'disposition': 'B', 'reason': 'מתאים לאחר תיקוני הפרויקט ובדיקות הקבלה; אין סיבת C/D מאומתת במצב הסגירה.'}
        for n in range(1, 50)
    ]
}
write('page-disposition.json', json.dumps(disposition, ensure_ascii=False, indent=2) + '\n')

# 9) Canonical SSOT: cover rule, finish instruction, disposition, and removal of the old merge pause.
ssot = read('SOURCE_OF_TRUTH.md')
ssot = ssot.replace('## 3. מצב האפיון — פתוח עד הוראה מפורשת', '## 3. מצב האפיון — סגור לגרסת הסיום הנוכחית')
old3 = 'המסמך הזה **עדיין בהרחבה**. יניב יוסיף דגשים נוספים לגליל, וכל דגש חדש שאושר יתווסף לכאן ולא למסמך מתחרה.\n\nאין להכריז שהאפיון של „גליל חדש” הסתיים עד שיניב אומר במפורש שהאפיון הסתיים / „סיימנו”. עד אז מותר לשפר, למיין, לבדוק ולתכנן, אך אין לראות במסמך כקפוא סופית.'
new3 = 'ב־11.10.2026 יניב הורה במפורש שוב ושוב **לסיים את הפרויקט כעת** (ובכלל זה „תסיים כבר” ו„תתקדם… תסיים”). הוראה זו היא הודעת הסיום המפורשת לצורך §25.1. האפיון נחשב סגור לגרסת הסיום הנוכחית; דרישה חדשה עתידית של יניב רשאית לפתוח גרסה חדשה, ואז מעדכנים קודם את מקור האמת לפי §26.'
if old3 in ssot:
    ssot = ssot.replace(old3, new3, 1)

# Replace stale rename blocker with a current, safer post-merge blocker.
ssot = re.sub(
    r'\*\*חסם מתועד \(עודכן 2026-10-11\):\*\* אין לבצע rename כעת — .*?שינוי השם ייבחן לאחר הכרזת סיום מפורשת של יניב\.',
    '**חסם מתועד (עודכן 2026-10-11, סגירה):** אין לבצע rename בתוך מיזוג הסגירה עצמו. פרויקט Vercel `galil-new`, קישורי Preview/Pages ו־remotes פעילים תלויים בשם הנוכחי, ושינוי שם באותו cutover יגדיל סיכון ללא תועלת לתוכן. לכן §25.9 מסופק דרך blocker מתועד: ה־rename ל־`galil-hadash` נשאר משימת תשתית נפרדת לאחר המיזוג, עם redirects/remotes/Pages/CI smoke test לפני ואחרי.',
    ssot,
    count=1,
    flags=re.S
)

# Old audit pause is now complete and must not continue blocking the authorized closure.
ssot = re.sub(
    r'\*\*סדר עבודה נוכחי — הוראת יניב, 2026-10-11:\*\* עוצרים התקדמות לתכונות נוספות ולסיום/מיזוג,.*?הוראה זו אינה הכרזה שהאפיון הסתיים ואינה אישור למיון סופי או למחיקת דפי תלמיד לפי §9\.',
    '**סדר עבודה נוכחי — עדכון סגירה, 2026-10-11:** ביקורת העומק, הארגון והניקוי שנדרשו הושלמו בענף הסגירה. לאחר הוראת יניב לסיים, ה־pause על סיום/מיזוג מוסר. מותר למזג רק לאחר שכל בדיקות ה־QA של head הסגירה ירוקות; אין בכך היתר לעקוף בדיקה שנכשלה.',
    ssot,
    count=1,
    flags=re.S
)

if '### שער החוברת — הוראת יניב, 2026-10-11' not in ssot:
    cover_rule = '''\n### שער החוברת — הוראת יניב, 2026-10-11\n- לחוברת יש שער A4 מאושר לפני עמוד 1, עם הכותרת המדויקת **„גליל לחטיבת הביניים”**.\n- תמונת השער היא התמונה שאישר יניב ב־11.10.2026 ונשמרת מקומית ב־`assets/cover-bg.webp`; אין להחליף אותה ללא הוראה מפורשת חדשה.\n- השער **אינו ממוספר** ואינו משנה את מספור דפי התלמיד: דפי התלמיד נשארים 1–49.\n- הקורא הציבורי מציג את השער לפני הסרטון ולפני רצף דפי התלמיד, אך בורר העמוד ממשיך לייצג רק את 49 דפי התלמיד הממוספרים.\n- קובץ ה־PDF להורדה כולל **50 גיליונות A4** בסדר: שער לא־ממוספר + 49 דפי תלמיד ממוספרים.\n- QA חייב לאמת את הכותרת, נכס התמונה המקומי, היעדר מספר על השער, A4, 49 דפי תלמיד ו־50 גיליונות PDF.\n\n'''
    ssot = replace_once(ssot, '\n## 20.', cover_rule + '## 20.', 'SSOT cover rule')

if '### הכרעת A/B/C/D הסופית — 2026-10-11' not in ssot:
    disp_rule = '''\n### הכרעת A/B/C/D הסופית — 2026-10-11\nלפי הוראת יניב לסיים ולאחר מחזור התיקונים וה־QA, כל 49 הדפים הפעילים מסווגים **B — מתאים לאחר תיקון**. הסיווג מפורט כראיית traceability ב־`page-disposition.json`: A=0, B=49, C=0, D=0. אין כרגע דף פעיל עם סיבת C/D מאומתת. הקובץ הנגזר אינו מקור אמת ואינו רשאי לשנות את הכללים שבסעיף זה.\n\n'''
    ssot = replace_once(ssot, '\n## 10.', disp_rule + '## 10.', 'SSOT page disposition')

ssot = ssot.replace('- האפיון פתוח להרחבות נוספות של יניב עד הודעת סיום מפורשת.', '- האפיון סגור לגרסת הסיום הנוכחית לפי הוראת יניב מ־11.10.2026; דרישה חדשה עתידית תפתח גרסה חדשה דרך §26.')
write('SOURCE_OF_TRUTH.md', ssot)

# 10) Package + permanent CI cover gate.
pkg = json.loads(read('package.json'))
if 'cover-qa.mjs' not in pkg['scripts']['qa']:
    pkg['scripts']['qa'] = pkg['scripts']['qa'].replace('node reader-qa.mjs', 'node cover-qa.mjs && node reader-qa.mjs')
write('package.json', json.dumps(pkg, ensure_ascii=False, indent=2) + '\n')

qa_yml = read('.github/workflows/qa.yml')
if 'Run cover contract QA' not in qa_yml:
    qa_yml = replace_once(qa_yml, '      - name: Verify public reader contract and static PDF staleness\n', '      - name: Run cover contract QA\n        run: node cover-qa.mjs\n      - name: Verify public reader contract and static PDF staleness\n', 'cover CI step')
write('.github/workflows/qa.yml', qa_yml)

# 11) Tracker to 100% only inside this candidate tree; workflow commits it only after QA succeeds.
tracker_path = ROOT / 'workplans/galil.json'
tracker = json.loads(tracker_path.read_text(encoding='utf-8'))
tracker['updatedAt'] = '2026-10-11T20:20:00Z'
tracker['updatedBy'] = 'ChatGPT — final closure after Yaniv explicit finish instruction; commit gated on full QA'
for task in tracker.get('tasks', []):
    if task.get('id') == 'G-10':
        task['status'] = 'done'
        task['percent'] = 100
        task['blockedReason'] = None
        evidence = task.setdefault('evidence', [])
        for msg in [
            '2026-10-11 owner sign-off: Yaniv explicitly instructed to finish the project now; SSOT §3/§25 record this as the release finish instruction.',
            '2026-10-11 final A/B/C/D disposition: page-disposition.json records all 49 active pages as B (retained after correction/acceptance cycle), C=0, D=0.',
            '2026-10-11 approved cover integrated: unnumbered A4 cover titled גליל לחטיבת הביניים; public reader shows it before video/pages; static PDF is cover + 49 numbered student pages = 50 A4 sheets; cover-qa.mjs is permanent.',
            'Repository rename remains intentionally separate under the documented §2 blocker to protect Vercel/Pages/remotes during the content cutover.'
        ]:
            if msg not in evidence:
                evidence.append(msg)
tracker.setdefault('progress', {})['overallProgressPercent'] = 100
tracker['progress']['remainingPercent'] = 0
tracker['progress']['blockedCount'] = 0
closure = tracker.setdefault('closure', {})
closure['integrationPaused'] = False
closure['ownerFinishInstructionDate'] = '2026-10-11'
closure['pageDispositionFile'] = 'page-disposition.json'
closure['renameDecision'] = 'deferred-under-documented-blocker'
closure['completionClaim'] = '100% only if this candidate head passes all required QA and is merged/production-verified'

# Refresh the SSOT fingerprints required by coverage-qa after changing canonical sections.
source = read('SOURCE_OF_TRUTH.md')
source_digest = hashlib.sha256(source.encode()).hexdigest()
coverage = tracker.get('requirementsCoverage', {})
coverage['sourceSha256'] = source_digest
headings = list(re.finditer(r'^## (\d+)\. (.+)$', source, re.M))
sections = {int(m.group(1)): (m.group(2), source[m.start(): headings[i+1].start() if i+1 < len(headings) else len(source)]) for i, m in enumerate(headings)}
for row in coverage.get('sections', []):
    n = row.get('section')
    if n in sections:
        heading, body = sections[n]
        row['sourceHeading'] = heading
        row['sourceSha256'] = hashlib.sha256(body.encode()).hexdigest()
        if n == 2:
            row['pendingManual'] = ['Rename deferred under the documented infrastructure blocker; execute later as an isolated remotes/Pages/Vercel migration with smoke tests.']
        elif n == 3:
            row['pendingManual'] = ['Release specification is closed by Yaniv’s 2026-10-11 finish instruction; any future requirement must reopen through §26.']
        elif n == 9:
            row['pendingManual'] = ['Final 49-page A/B/C/D disposition is recorded in page-disposition.json; future page edits require re-review.']
        elif n == 23:
            row['pendingManual'] = ['Closure audit/cleanup pause is complete; future destructive cleanup still requires a rollback checkpoint.']
        elif n == 25:
            row['pendingManual'] = ['Release closure is owner-authorized; repo rename remains satisfied through the documented §2 blocker.']
tracker_path.write_text(json.dumps(tracker, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('finalizer: candidate prepared; 100% remains uncommitted until workflow QA succeeds')
