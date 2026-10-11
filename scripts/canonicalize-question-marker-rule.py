from pathlib import Path
import json

ssot_path=Path('SOURCE_OF_TRUTH.md')
ssot=ssot_path.read_text(encoding='utf-8')
anchor='אין להעתיק עיצוב ישן רק משום שהוא קיים. אם רכיב היסטורי נראה מיושן/צפוף/לא ברור — מעצבים אותו מחדש תוך שמירת התוכן המאושר.'
rule='''\n\n**סימון שאלות וסעיפים ללא מספור גלוי — כלל מחייב (הוראת יניב, 2026-10-11):** בדפי התלמיד **אין להציג מספרי שאלות גלויים** כגון `1.`, `2.`, `3.` בתחילת שאלה. כל שאלה ראשית נפתחת בסמן **עגול כחול בולט** במקום מספר; סעיפי משנה מקבלים סמן עגול כחול קטן יותר במקום אות/מספר גלוי כאשר זהו מבנה התצוגה המאושר. מספרי העמודים נשארים מספריים ואינם מושפעים. בשאלות רשמיות/נעולות 1:1 מספרי השאלה והסעיף המקוריים נשמרים בקוד/DOM לצורכי נאמנות, traceability ו־QA, אך מוסתרים חזותית ומוחלפים בסמנים — אסור לשנות בשל כך את נוסח המקור, הנתונים, הסדר או מזהי השאלות. כלל זה הוא כלל תצוגה בלבד וחייב להיות נעול ב־QA כך שמספרי שאלות גלויים לא יחזרו ברגרסיה.'''
if 'סימון שאלות וסעיפים ללא מספור גלוי' not in ssot:
    if anchor not in ssot:
        raise SystemExit('SSOT design anchor not found; refusing broad rewrite')
    ssot=ssot.replace(anchor,anchor+rule,1)
    ssot_path.write_text(ssot,encoding='utf-8')

qa_path=Path('qa.mjs')
qa=qa_path.read_text(encoding='utf-8')
marker='// SSOT canonical marker governance guard (Yaniv 2026-10-11).'
if marker not in qa:
    insertion='''\n\n// SSOT canonical marker governance guard (Yaniv 2026-10-11).\nassert(ssot.includes('סימון שאלות וסעיפים ללא מספור גלוי') && ssot.includes('עגול כחול בולט') && ssot.includes('מספרי העמודים נשארים מספריים'), 'SSOT must canonically require blue question markers instead of visible question numbering while preserving page numbers');\n'''
    # qa.mjs already defines ssot + assert and already locks the CSS marker implementation.
    needle="assert(/\\.a4-page \\.q-item \\.q-num::after"
    pos=qa.find(needle)
    if pos<0:
        raise SystemExit('existing marker QA lock not found; refusing unrelated QA rewrite')
    line_end=qa.find('\n',pos)
    qa=qa[:line_end+1]+insertion+qa[line_end+1:]
    qa_path.write_text(qa,encoding='utf-8')

tracker_path=Path('workplans/galil.json')
tracker=json.loads(tracker_path.read_text(encoding='utf-8'))
tracker['updatedAt']='2026-10-11T15:25:00+03:00'
for task in tracker.get('tasks',[]):
    if task.get('id')=='G-08':
        note='2026-10-11 (governance repair): the already-shipped blue question/subsection markers from PR #9 were found implemented and QA-locked but not stated explicitly in SOURCE_OF_TRUTH.md. Canonicalized the exact display rule in §17: no visible question numbers, prominent blue circle for main questions, smaller blue circle for subsections, page numbers remain numeric, locked official source numbers stay in DOM only. Added an SSOT assertion to qa.mjs; no student pixels/content/math changed.'
        ev=task.setdefault('evidence',[])
        if note not in ev: ev.append(note)
tracker_path.write_text(json.dumps(tracker,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
