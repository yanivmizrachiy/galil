# מפת מקורות — גליל חדש

> מסמך ראיות וניווט בלבד. מקור הדרישות היחיד הוא [`SOURCE_OF_TRUTH.md`](SOURCE_OF_TRUTH.md).

## מקור תוכנית הלימודים

- ריפו: `yanivmizrachiy/jerusalem2`.
- קובץ: `src/content/curriculum-fragments/idkun-geometri-8/idkun-geometri-8-p001-025.json`.
- עמודים רלוונטיים שנבדקו: 14–19.
- Blob נעול: `64406e6f6615fe798aa5bea3799270b4d8ae5c80`.
- סריקות מקור: `public/media/curriculum/idkun-geometri-8/pages` בריפו המקור, ב־commit `45a6024f2448417f42114caa866006d1942cb714`.

[`official-questions-source.json`](official-questions-source.json) שומר את צילום המצב של טקסט המקור, סדר השאלות `1, 2, 3, 4, 5, 7`, פרטי המקור וראיות האימות החזותי. שאלה 6 במקור עוסקת בחרוט. שאלות 1, 3 ו־4 מסומנות כ־`text_locked_diagram_verified`, עם ראיות מסריקות המקור; שאלות 2, 5 ו־7 מסומנות ללא תלות בשרטוט. זהו מצב הראיות המתועד בקובץ, ולא אישור סיום החוברת.

בדיקות נגזרות: [`official-source-qa.mjs`](official-source-qa.mjs) בודק את נעילת המקור; [`official-render-qa.mjs`](official-render-qa.mjs) בודק את המימוש בעמודים 44–49; [`official-source-visual-evidence.mjs`](official-source-visual-evidence.mjs) אוסף את סריקות המקור הנעולות כאשר יש גישה לריפו הפרטי. הדרישות המחייבות לשאלות הרשמיות נמצאות בסעיף 6 של מקור האמת.

## צילום ההשראה שסיפק יניב

יניב סיפק צילום של עמוד בנושא שטחי גליל. הצילום אינו שמור כרגע בריפו. הדרישות שאושרו בעקבותיו נמצאות בסעיף 27 של [`SOURCE_OF_TRUTH.md`](SOURCE_OF_TRUTH.md); רשימה נוספת שלהן אינה מתוחזקת כאן.

## מקורות המימוש ההיסטורי

פירוט הפרובננס נמצא ב־[`PROVENANCE.md`](PROVENANCE.md):

- `yanivmizrachiy/razpages`: מקור היסטורי ל־`index.html`, לעמודים 1–38, ל־`qa.mjs` ול־`vendor/mathjax/`.
- `yanivmizrachiy/smartschool-hebrew-voice-notes`: מקור היסטורי ל־`styles.css`.

אלה תיאורי מקור של קוד, ואינם הוראות לפיתוח הנוכחי.

## ניווט לדרישות ולמצב הפרויקט

הסמכות היחידה מוגדרת בסעיף 1 של מקור האמת; מצב האפיון בסעיף 3; עמודי מורה בסעיף 22; ניקוי הריפו בסעיף 23; תנאי סיום בסעיף 25; סנכרון הוראות חדשות בסעיף 26. מצב הביצוע והראיות מתועדים ב־[`workplans/galil.json`](workplans/galil.json).
