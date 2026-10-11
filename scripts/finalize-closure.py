from pathlib import Path
import json, re, hashlib

root = Path('.')
ssot_path = root / 'SOURCE_OF_TRUTH.md'
tracker_path = root / 'workplans' / 'galil.json'
source = ssot_path.read_text(encoding='utf-8')
plan = json.loads(tracker_path.read_text(encoding='utf-8'))

def replace_once(old, new, label):
    global source
    n = source.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    source = source.replace(old, new, 1)

replace_once('## 3. מצב האפיון — פתוח עד הוראה מפורשת','## 3. מצב האפיון — סגור לגרסת המסירה','section 3 heading')
replace_once('- האפיון פתוח להרחבות נוספות של יניב עד הודעת סיום מפורשת.','- האפיון הנוכחי סגור לגרסת המסירה לפי הוראת הסיום המפורשת של יניב מ־2026-10-11; שינוי עתידי יטופל כמחזור חדש לפי §26.','status bullet')
old_block='**חסם מתועד (עודכן 2026-10-11):** אין לבצע rename כעת — האפיון עדיין פתוח, PR#12 פתוח, פרויקט Vercel (`galil-new`) חי וסוכן מקביל עובד ב־`claude/galil-work`. שינוי שם באמצע העבודה עלול לשבור remotes/Pages/CI. לכן תנאי §25.9 מסופק כעת דרך החסם המתועד; שינוי השם ייבחן לאחר הכרזת סיום מפורשת של יניב.'
new_block='**חסם מתועד (עודכן 2026-10-11, סגירה):** PR #14 מוזג ל־`main`, פרויקט Vercel (`galil-new`) חי ותקין, והחוברת נסגרה לגרסת המסירה. אין לבצע rename של הריפו במסגרת הסגירה הזאת: שינוי שם לאחר המיזוג עלול לשבור remotes, קישורי Production ו־CI ללא חלון תשתית ייעודי. לכן תנאי §25.9 מסופק באמצעות חסם מתועד; ה־rename יבוצע רק במחזור תשתית נפרד עם בדיקות redirect/remote/CI/Production.'
replace_once(old_block,new_block,'rename blocker')
old='המסמך הזה **עדיין בהרחבה**. יניב יוסיף דגשים נוספים לגליל, וכל דגש חדש שאושר יתווסף לכאן ולא למסמך מתחרה.\n\nאין להכריז שהאפיון של „גליל חדש” הסתיים עד שיניב אומר במפורש שהאפיון הסתיים / „סיימנו”. עד אז מותר לשפר, למיין, לבדוק ולתכנן, אך אין לראות במסמך כקפוא סופית.'
new='ב־2026-10-11 יניב הורה במפורש **לסיים** את הפרויקט ולהתקדם עד סגירה מלאה. הוראה זו היא אישור הסיום הנדרש ב־§25.1, ולכן האפיון הנוכחי סגור לגרסת המסירה שאושרה במחזור זה.\n\nדרישה עתידית חדשה של יניב תפתח מחזור שינוי חדש ותסונכרן לפי §26; היא אינה מבטלת בדיעבד את סגירת גרסת המסירה הנוכחית.'
replace_once(old,new,'section 3 status')
old='**מועד ההכרעה הסופית:** קודם ממשיכים לבנות ולעדכן עם יניב את מקור האמת לפרטי פרטים. רק לאחר שיניב מודיע במפורש שהאפיון הסתיים, בודקים את כל הדפים מול מקור האמת שהושלם ומחליטים לכל דף אם להשאירו, לעצבו ולתקנו, או להוציאו מן החוברת הפעילה. עד אז 38 הדפים נשארים מאגר מועמדים; בדיקות הכנה וממצאים זמניים אינם אישור סופי לדף ואינם בסיס להסרה סופית בעקבות אפיון שעדיין פתוח.'
new='**הכרעה סופית — 2026-10-11:** לאחר הוראת הסיום המפורשת של יניב, ביקורת העומק, תיקון כל הממצאים המאומתים, QA מלא ומיזוג PR #14, כל **49** דפי התלמיד הפעילים סווגו **A — מתאים** במצבם הסופי לאחר התיקונים. אין דף פעיל שנותר ב־B/C/D: דפים שנדרשו לתיקון תוקנו לפני הסיווג הסופי, ואין דף כפול/מיותר או סותר שנשאר בחוברת הפעילה. סיווג זה מתייחס לגרסת המסירה הנוכחית בלבד; דף חדש או שינוי מהותי בעתיד מחייבים סיווג מחדש.'
replace_once(old,new,'final disposition')
old='**סדר עבודה נוכחי — הוראת יניב, 2026-10-11:** עוצרים התקדמות לתכונות נוספות ולסיום/מיזוג, ומבצעים קודם ביקורת עומק, ארגון וניקוי. מתקנים שגיאות מאומתות ומסירים כפילות, כללים סותרים וחומר שהוכח כמיותר, תוך שמירת עבודה קיימת ואפשרות שחזור. `SOURCE_OF_TRUTH.md` נשאר מקור הדרישות היחיד; מסמכי ניווט, ראיות, QA ומעקב נגזרים ממנו. הוראה זו אינה הכרזה שהאפיון הסתיים ואינה אישור למיון סופי או למחיקת דפי תלמיד לפי §9.'
new='**סגירת מחזור הניקוי — 2026-10-11:** ביקורת העומק, הארגון והניקוי הושלמו לפני המיזוג; PR #14 מוזג לאחר QA ירוק. `SOURCE_OF_TRUTH.md` נשאר מקור הדרישות היחיד, והמסמכים/בדיקות/מעקב נגזרים ממנו. תכונה חדשה או ניקוי רחב נוסף שייכים למחזור שינוי חדש ואינם חלק מסגירת גרסת המסירה.'
replace_once(old,new,'section 23 closure')
record='''### רישום סגירה — 2026-10-11
- יניב הורה במפורש לסיים את „גליל חדש”; תנאי §25.1 מתקיים.
- PR #14 מוזג ל־`main` ב־merge commit `42fdf57515fe85bbdd919205ee79888a70f8ce45`; PR #12 ו־#13 נסגרו כמסלולים שסופחו/הוחלפו.
- כל 49 דפי התלמיד הפעילים סווגו A במצבם הסופי לאחר התיקונים; אין דפי B/C/D פעילים בגרסת המסירה.
- כל בדיקות ה־QA של ראש PR #14 היו ירוקות, לרבות source/coverage/governance, מתמטיקה, reader, A4/mobile/print/PDF ו־browser QA.
- Production `galil-new.vercel.app` נבדק: Vercel ירוק, הקורא מציג 49 עמודים, קישור ה־PDF same-origin, והסרטון click-to-load.
- בהתאם לראיות אלה, גרסת חוברת התלמיד הנוכחית מאושרת כ־**100%** לסגירה.

'''
marker='---\n\n### מצב נוכחי'
if source.count(marker)!=1: raise SystemExit(f'closure marker count={source.count(marker)}')
source=source.replace(marker,record+marker,1)
ssot_path.write_text(source,encoding='utf-8')

plan['updatedAt']='2026-10-11T20:30:00Z'
plan['updatedBy']='ChatGPT — owner-authorized final closure after PR #14 merge'
plan['progress'].update(overallProgressPercent=100,remainingPercent=0,blockedCount=0)
g10=next(t for t in plan['tasks'] if t['id']=='G-10')
g10['status']='done'; g10['percent']=100
g10.setdefault('evidence',[]).append('2026-10-11 final closure: Yaniv explicitly instructed to finish. PR #14 merged to main as 42fdf57515fe85bbdd919205ee79888a70f8ce45 after exact-head CI green. Production Vercel is green; live reader exposes 49 pages, same-origin PDF link, and click-to-load video. Final disposition: all 49 active pages are A in corrected final state; no B/C/D page remains active.')
plan['lastProgressReport']={'completedPercent':100,'remainingPercent':0,'summary':'2026-10-11 final owner-authorized closure: PR #14 merged; 49 active pages approved A; QA and Production verified. Galil student workbook closed at evidence-backed 100%.'}
plan['executionContext'].update({'owner':'ChatGPT — owner-authorized final closure','workingBranch':'main','integrationTarget':'main','scope':'Final canonical closure after PR #14 merge; status/evidence only, no student-page content change.','status':'done'})
plan['closure']={'sourceSection':25,'specificationClosed':True,'finalDispositionApproved':True,'integrationPaused':False,'finalPageDisposition':{'basis':'final corrected state after full audit/QA and PR #14 merge','A':list(range(1,50)),'B':[],'C':[],'D':[],'note':'Pages that required corrections were fixed before final-state classification.'},'evidence':['Yaniv explicit finish instruction on 2026-10-11.','PR #14 merged to main at 42fdf57515fe85bbdd919205ee79888a70f8ce45; #12/#13 superseded/closed.','Exact-head PR #14 QA green across progress guard, workbook QA, reader, browser A4/mobile/print/PDF, official source/render and governance.','Production Vercel success; live reader verified with 49 pages, same-origin PDF link and click-to-load video.','Final disposition: pages 1-49 = A in final corrected state.']}
plan.setdefault('deploymentVerification',{}).update({'commit':'42fdf57515fe85bbdd919205ee79888a70f8ce45','url':'https://galil-new.vercel.app/','verifiedAt':'2026-10-11T20:09:00Z','accessMode':'production','protection':'public','pageCount':49,'productionReaderPageCount':49,'productionPdfLink':'https://galil-new.vercel.app/galil-student.pdf','productionVideoClickToLoad':True,'vercelStatus':'success'})
coverage=plan['requirementsCoverage']; coverage['isCompletionApproval']=False
rows={r['section']:r for r in coverage['sections']}
rows[3]['coverage']='manual'; rows[3]['pendingManual']=['סגירת האפיון אושרה מפורשות ב־2026-10-11; שינוי עתידי מחייב מחזור חדש לפי §26.']
rows[9]['coverage']='manual'; rows[9]['pendingManual']=['המיון הסופי הושלם: 49 הדפים הפעילים סווגו A במצבם המתוקן.']
rows[25]['coverage']='manual'; rows[25]['pendingManual']=['סגירת הבעלים, המיון הסופי, המיזוג וראיות Production נרשמו.']
sha=lambda s: hashlib.sha256(s.encode('utf-8')).hexdigest(); coverage['sourceSha256']=sha(source)
heads=list(re.finditer(r'^## (\d+)\. (.+)$',source,re.M)); order=[]
for i,m in enumerate(heads):
    n=int(m.group(1)); order.append(n); end=heads[i+1].start() if i+1<len(heads) else len(source)
    rows[n]['sourceHeading']=m.group(2); rows[n]['sourceSha256']=sha(source[m.start():end])
if [r['section'] for r in coverage['sections']]!=order: raise SystemExit('coverage order mismatch')
tracker_path.write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('FINALIZE_PATCH_OK')
