# CLAUDE.md

## הפרויקט
ARCHI-TACT משרד (ריפו Misrad, פרויקט Vercel misrad, כתובת https://archi-tact-misrad.vercel.app). ניהול משרד אדריכלות: שלבים, אישורי לקוח, דרישות תשלום ותזרים. גרסה מחודשת של אפליקציית Lovable "ARCHI-TACT Flow" (build-bridge-pay.lovable.app). אפיון: docs/SPEC.md. עובדים לפי הסקיל `.claude/skills/anat-app-builder`.

## כללים קבועים
- עברית ו-RTL. בלי אייקונים בממשק, חוץ מאייקון האפליקציה.
- סרגל עליון קבוע בכל הדפים. שם האפליקציה מקשר לבית. קישורי ניווט ממוספרים.
- אחרי בדיקה ירוקה (`npm run build && npm test`): מיזוג ל-main בלי לשאול.
- מסירה: כתובת סופית ושורה אחת.
- כל סכום, סיכון ותחזית נגזרים מ-`src/domain/logic.ts`. לא כותבים מספרים בתוך רכיבים.
- כפתורים מרובעים, קו שערה, דיו שנכנסת, סימני חיתוך. צבעי מצב שלב: עתידי אפור, בעבודה צפחה, ממתין לאישור #b8860b, אושר ולא חויב #2f6f86, נשלחה דרישה #8a6a1f, שולם #2a8a5a, באיחור #b03a48. תמיד עם תווית.
- דפי לקוח וקבלן: הלוגו בלי תפריט.

## A&I logo button
The top bar holds only the app name (links home), content navigation, and ONE logo button "אד' ענת שטיבלמן A&I" (`<ai-menu>` from https://appofapp-gh.vercel.app/ai-menu.js). Every editing and development action (העתקת קישור, שיחת הפיתוח, פרויקט המחקר, התקנת האפליקציה, edit mode, add, delete) lives only inside it, never as loose buttons. Standard: https://github.com/Anat1969/AppOfApp-GH/blob/main/docs/ai-menu-standard.md

## למדנו בבנייה
- AnimatePresence עם mode="wait" מעכב את התוכן החדש: בבדיקות לחכות לאלמנט (waitFor), לא isVisible מיידי.
- שני עדכוני searchParams ברצף דורסים זה את זה: לבנות URLSearchParams אחד ולעדכן פעם אחת.
- שמירה ל-localStorage בתוך mutate עצמו, לא רק ב-effect, כדי שסגירת לשונית מיד אחרי פעולה לא תאבד אותה.
- Playwright מקומי: devDependency באותה גרסה כמו הגלובלית (1.63.0), כדי שימצא את הדפדפן המותקן.

## יומן תיקונים של ענת
- 2026-10-26: "מה שיש כרגע זה רמה 1, אני רוצה רמה 999": בנייה מחדש לפי הסקיל, מכלי מדומה לכלי עבודה.
- הכתובת misrad.vercel.app תפוסה על ידי אתר אחר. הדומיין הקבוע: archi-tact-misrad.vercel.app.
