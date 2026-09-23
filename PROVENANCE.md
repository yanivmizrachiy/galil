# PROVENANCE — galil (גליל)

תיעוד בלבד. הדרישות המחייבות נמצאות ב־`RULES.md`. הנתונים המלאים: `workbook.json` (מקור כל דף ושאלה), `provenance/coverage.json` (מטריצת כיסוי), `provenance/page-accounting.json` (כל דף מהשלב הקודם → דף סופי), `provenance/changes.json` (כל שינוי).

## מקורות

| ריפו | commit | נתיבים | תפקיד |
|---|---|---|---|
| `yanivmizrachiy/razpages` | `c8fe7bde7ee19215b5593f9379c3db2f0c846538` | workbooks/cylinder/page-1..38.html (+ vendor/mathjax) | 38 cylinder pages (data-layout y1..y38) incl. local-MathJax fixes on pages 11-14 |
| `yanivmizrachiy/smartschool-hebrew-voice-notes` | `760f64e82dc6f309c67324df100399532f89bc8f` | cylinder/styles.css | A4 utilization (29d7c6c) |
| `yanivmizrachiy/jerusalem2` | `ffa9833f9f` | public/media/curriculum/idkun-geometri-8/pages/page-014..019.webp, fig-p14..19 | official cylinder questions Q1-Q5, Q7 (moe8-*) |
| `yanivmizrachiy/bbb` | `e365c0f3c92d98a379b511aec6aeca032e4a8391` | geometry8/topics/t01_circle.py section ג | coverage cross-check of the cylinder questions |
| `yanivmizrachiy/smartschool-hebrew-voice-notes (branch chore/world-class-architecture-chatgpt-20260826-2324)` | `47ad6ebda643797a835d09088e7a6ebb82cb2a83 / b628fcc / f9c078c` | cylinder/page-39..41.html; definition wording; name/date removal | lateral area, total surface area and net pages (br-y39..41); official cylinder definition; no name/date fields |

תוכנית הלימודים: משרד החינוך, „תחום גאומטרי לכיתה ח” (geometry_8.pdf, עדכון תשפ״ז) — https://meyda.education.gov.il/files/Pop/0files/matmatika/Chativat-Beynayim/curriculum/updating/geometry_8.pdf

## מספרים

- דפים: **46** (38 phase-1 pages − 0 replaced/merged/retired + 8 added = 46 final pages).
- שאלות: **138**, מתוכן **6** בלוקים של שאלות מתוך תוכנית הלימודים (6 שאלות רשמיות).
- שורות כיסוי: Counter({'other-repo': 33, 'imported': 12, 'irrelevant': 2}).
- שינויים מתועדים: 124 ({'official-presentation': 3, 'dedupe-vary': 35, 'other': 15, 'fix-wording': 20, 'dedupe-remove': 8, 'internal-text': 3, 'fix-table': 2, 'overflow': 6, 'fix-figure': 14, 'sub-bullets': 4, 'fix-math': 8, 'page-ref': 1, 'ported-from-branch': 5}).

## טרנספורמציות מבניות (כל הדפים)

- שלב 1 (העתקה): תוכן זהה בית־לבית למקור; שינויי נתיב בלבד.
- חומר שנטען בזמן ריצה (loader) הפך לדפים סטטיים; החרוט פוצל מקובץ אחד ל־page-N.html (נבדק: זהות פיקסלים/גאומטריה).
- מספרי שאלות הוסרו; תבליט גדול לשאלה, קטן לסעיף; כותרת תוכנית הלימודים לפי RULES §5.
- כללי CSS שהיו קשורים למספר הדף הגלוי הועברו ל־`data-layout` (תיקן 17 דפי מעגל שחרגו מ־A4).
- סדר פדגוגי לפי RULES §6 (שלבים ב־`workbook.json`).

## חשבון דפים (דפי השלב הקודם → סופי)

| דף קודם | layout | דף סופי | סטטוס | סיבה |
|---|---|---|---|---|
| 1 | `y1` | 1 | preserved | same page |
| 2 | `y2` | 2 | preserved | same page |
| 3 | `y3` | 3 | preserved | same page |
| 4 | `y4` | 4 | preserved | same page |
| 5 | `y5` | 5 | preserved | same page |
| 6 | `y6` | 6 | preserved | same page |
| 7 | `y7` | 7 | preserved | same page |
| 8 | `y8` | 8 | preserved | same page |
| 9 | `y9` | 9 | preserved | same page |
| 10 | `y10` | 11 | moved | pedagogical order (RULES §6): stage 'ידע קודם: חזרה על המעגל' |
| 11 | `y11` | 10 | moved | pedagogical order (RULES §6): stage 'ידע קודם: חזרה על המעגל' |
| 12 | `y12` | 12 | preserved | same page |
| 13 | `y13` | 13 | preserved | same page |
| 14 | `y14` | 17 | moved | pedagogical order (RULES §6): stage 'מושג הנפח, יחידות נפח וקיבול' |
| 15 | `y15` | 14 | moved | pedagogical order (RULES §6): stage 'שטח הבסיס' |
| 16 | `y16` | 15 | moved | pedagogical order (RULES §6): stage 'שטח הבסיס' |
| 17 | `y17` | 16 | moved | pedagogical order (RULES §6): stage 'מושג הנפח, יחידות נפח וקיבול' |
| 18 | `y18` | 18 | preserved | same page |
| 19 | `y19` | 21 | moved | pedagogical order (RULES §6): stage 'נפח = שטח בסיס · גובה' |
| 20 | `y20` | 22 | moved | pedagogical order (RULES §6): stage 'נפח = שטח בסיס · גובה' |
| 21 | `y21` | 23 | moved | pedagogical order (RULES §6): stage 'נפח = שטח בסיס · גובה' |
| 22 | `y22` | 24 | moved | pedagogical order (RULES §6): stage 'נפח = שטח בסיס · גובה' |
| 23 | `y23` | 19 | moved | pedagogical order (RULES §6): stage 'מושג הנפח, יחידות נפח וקיבול' |
| 24 | `y24` | 20 | moved | pedagogical order (RULES §6): stage 'מושג הנפח, יחידות נפח וקיבול' |
| 25 | `y25` | 25 | preserved | same page |
| 26 | `y26` | 26 | preserved | same page |
| 27 | `y27` | 27 | preserved | same page |
| 28 | `y28` | 29 | moved | pedagogical order (RULES §6): stage 'נפח הגליל' |
| 29 | `y29` | 28 | moved | pedagogical order (RULES §6): stage 'נפח הגליל' |
| 30 | `y30` | 30 | preserved | same page |
| 31 | `y31` | 32 | moved | pedagogical order (RULES §6): stage 'מדויק ומקורב; קיבול כלים' |
| 32 | `y32` | 33 | moved | pedagogical order (RULES §6): stage 'מדויק ומקורב; קיבול כלים' |
| 33 | `y33` | 34 | moved | pedagogical order (RULES §6): stage 'מדויק ומקורב; קיבול כלים' |
| 34 | `y34` | 35 | moved | pedagogical order (RULES §6): stage 'מדויק ומקורב; קיבול כלים' |
| 35 | `y35` | 36 | moved | pedagogical order (RULES §6): stage 'בעיות הפוכות' |
| 36 | `y36` | 37 | moved | pedagogical order (RULES §6): stage 'בעיות הפוכות' |
| 37 | `y37` | 38 | moved | pedagogical order (RULES §6): stage 'בעיות הפוכות' |
| 38 | `y38` | 40 | moved | pedagogical order (RULES §6): stage 'סיכום נפח הגליל' |

**דפים חדשים:**

- דף 31 `moe8-p16-1` — צנצנות הדבש (`yanivmizrachiy/jerusalem2@ffa9833f9f:public/media/curriculum/idkun-geometri-8/pages/page-016.webp`)
- דף 39 `moe8-p14-2` — נפח של כלים (`yanivmizrachiy/jerusalem2@ffa9833f9f:public/media/curriculum/idkun-geometri-8/pages/page-014.webp`)
- דף 41 `br-y39` — מעטפת הגליל — מלבן ושטחה (`yanivmizrachiy/smartschool-hebrew-voice-notes@47ad6ebda643797a835d09088e7a6ebb82cb2a83:cylinder/page-39.html`)
- דף 42 `br-y40` — שטח הפנים של הגליל (`yanivmizrachiy/smartschool-hebrew-voice-notes@47ad6ebda643797a835d09088e7a6ebb82cb2a83:cylinder/page-40.html`)
- דף 43 `br-y41` — פריסה ומגלגלים דף לגליל (`yanivmizrachiy/smartschool-hebrew-voice-notes@47ad6ebda643797a835d09088e7a6ebb82cb2a83:cylinder/page-41.html`)
- דף 44 `moe8-p19-1` — מגלגלים דף לגליל (`yanivmizrachiy/jerusalem2@ffa9833f9f:public/media/curriculum/idkun-geometri-8/pages/page-019.webp`)
- דף 45 `moe8-p14-1` — נפח ושטח מעטפת (`yanivmizrachiy/jerusalem2@ffa9833f9f:public/media/curriculum/idkun-geometri-8/pages/page-014.webp`)
- דף 46 `moe8-p15-1` — משולשים בתוך גליל (`yanivmizrachiy/jerusalem2@ffa9833f9f:public/media/curriculum/idkun-geometri-8/pages/page-015.webp`)

## פריטים פתוחים

- אין.
