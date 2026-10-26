# CLAUDE.md

## הפרויקט
ARCHI-TACT משרד (ריפו Misrad, פרויקט Vercel misrad, כתובת https://archi-tact-misrad.vercel.app). ניהול משרד אדריכלות: שלבים, אישורי לקוח, דרישות תשלום ותזרים. גרסה מחודשת של אפליקציית Lovable "ARCHI-TACT Flow" (build-bridge-pay.lovable.app). אפיון: docs/SPEC.md. עובדים לפי הסקיל `.claude/skills/anat-app-builder`.

## ענן
- Supabase: פרויקט cultura-GH (ktqmwpbzcnzkhjskqisy), משותף לאפליקציות אחרות. כל הטבלאות בקידומת msr_. מיגרציות ב-supabase/migrations.
- כניסה חופשית, בלי הרשמה: משרד מזוהה במפתח פרטי (נשמר רק ה-sha256), במכשיר ובקישור האישי `/?office=KEY`. הטבלאות סגורות ל-anon, וכל גישה דרך פונקציות msr_ (SECURITY DEFINER).
- המסמך כולו (AppData) נשמר כ-jsonb עם מספר גרסה. שמירה עם גרסה ישנה מחזירה התנגשות, והמשתמשת בוחרת גרסה. שום דבר לא נדרס בשקט.
- פורטל לקוח וקבלן: `/c/TOKEN` ו-`/k/TOKEN`, קבועים ומתעדכנים בכל שמירה. תגובות (אישור, הערות, דיווח, הגעה) נכנסות ל-msr_responses ומוחלות אצל הסטודיו בסנכרון הבא. בלי חיבור: קישור עם תמונת מצב ב-hash וקוד אישור.

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
- סביבת הענן לא מגיעה ל-supabase.co (403 מה-proxy): פונקציות msr_ נבדקות ב-SQL דרך כלי Supabase, והאפליקציה מול מוק בזיכרון ב-tests/e2e.mjs שמחקה את אותם כללים.

## יומן תיקונים של ענת
- 2026-10-26: "מה שיש כרגע זה רמה 1, אני רוצה רמה 999": בנייה מחדש לפי הסקיל, מכלי מדומה לכלי עבודה.
- הכתובת misrad.vercel.app תפוסה על ידי אתר אחר. הדומיין הקבוע: archi-tact-misrad.vercel.app.
- 2026-10-26: "פרויקט CULTURA-GH בסופה": סנכרון בענן בפרויקט Supabase cultura-GH, קידומת msr_.
- 2026-10-26: שלושה "פרויקטים לדוגמה" להוראה ולמכירה (EX-01 הגשר, EX-02 גבייה, EX-03 אושר ולא חויב), עם פס "מה מראים כאן", איפוס מכפתור הלוגו, ומספור דרישות נפרד (9001+) שלא נוגע במשרד אמיתי.
