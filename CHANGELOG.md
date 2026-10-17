# سجل التحديثات وروابط النشر 🔖

> هذا الملف يحفظ **رابط GitHub ونسخة النشر لكل تغيير** في الموقع.
> بعد كل تعديل جديد: يُضاف صفٌّ في جدول «سجل التغييرات» يحمل رابط الـ commit ورابط النشر المباشر.

## الروابط الثابتة

| الوجهة | الرابط |
|---|---|
| المستودع | https://github.com/asmaagamal1981-ops/juz-amma |
| الموقع المنشور | https://asmaagamal1981-ops.github.io/juz-amma/ |
| صفحة اختبارات التقييم | https://asmaagamal1981-ops.github.io/juz-amma/quiz.html |
| سجل التغييرات (Commits) | https://github.com/asmaagamal1981-ops/juz-amma/commits/main |
| عمليات النشر (Actions) | https://github.com/asmaagamal1981-ops/juz-amma/actions |
| إعدادات النشر | https://github.com/asmaagamal1981-ops/juz-amma/settings/pages |

## سجل التغييرات

| # | التاريخ | التغيير | رابط الـ Commit | رابط النشر |
|---|---|---|---|---|
| 1 | 2026-10-11 | النشر الأول: موقع تفسير جزء عم — 37 سورة + اختبار مدمج + تتبع الإنجاز | [a47eac1](https://github.com/asmaagamal1981-ops/juz-amma/commit/a47eac1) | [نشر #38154299330](https://github.com/asmaagamal1981-ops/juz-amma/actions/runs/38154299330) |
| 2 | 2026-10-17 | إضافة صفحة `quiz.html`: اختبارات تقييم مستقلة (بنك ٣٣٣ سؤالًا • إعداد مخصص • مؤقّت • تحليل نتائج • مشاركة رابط اختبار) + تحديث القائمة الرئيسية وسير النشر | [3a46982](https://github.com/asmaagamal1981-ops/juz-amma/commit/3a46982) | [نشر #39058145505](https://github.com/asmaagamal1981-ops/juz-amma/actions/runs/39058145505) |
| 3 | 2026-10-17 | إنشاء سجل التحديثات وروابط النشر (هذا الملف) | [da6990c](https://github.com/asmaagamal1981-ops/juz-amma/commit/da6990c) | [نشر #39059551304](https://github.com/asmaagamal1981-ops/juz-amma/actions/runs/39059551304) |
| 4 | 2026-10-17 | تطبيق جوال PWA: `manifest.webmanifest` + `sw.js` (عمل دون إنترنت) + `pwa.js` (زر التثبيت) + 4 أيقونات + اختصارات التطبيق | يُكتب في التحديث التالي | — |

## النسخ المنشورة

| النسخة | الرابط | التاريخ |
|---|---|---|
| v1 — النسخة الأولى | https://asmaagamal1981-ops.github.io/juz-amma/ | 2026-10-11 |
| v2 — مع صفحة الاختبارات | https://asmaagamal1981-ops.github.io/juz-amma/quiz.html | 2026-10-17 |
| v3 — مع سجل الروابط | https://github.com/asmaagamal1981-ops/juz-amma/blob/main/CHANGELOG.md | 2026-10-17 |

> **قاعدة المتابعة:** كل تغيير جديد يُضاف صفُّه في جدول «سجل التغييرات» يحمل رابط الـ commit ورابط النشر.
> رابط الـ commit لنفسه يُكتب في التحديث التالي (لأن رقمه لا يُعرف إلا بعد الدفع)، لذا يُكتب آخر صف دائمًا في التغيير التالي.

## كيف تُحفظ نسخة كل تغيير؟

كل دفعة إلى فرع `main` تُنشئ **commit** و**نسخة منشورة** تلقائيًا عبر GitHub Actions:

1. commit محلي: `git commit -m "وصف التغيير"`
2. رفع: `git push origin main`
3. النشر يعمل تلقائيًا ويُحدّث الموقع خلال ثوانٍ
4. الرابط الدائم لأي تغيير:
   - كود المصدر: `https://github.com/asmaagamal1981-ops/juz-amma/blob/main/الملف`
   - نسخة ذلك الإصدار بالضبط: `https://github.com/asmaagamal1981-ops/juz-amma/tree/<رقم-الـ-commit>`
5. لإرجاع الموقع لأي نسخة سابقة: من صفحة الـ commit اضغط **Browse files** أو استخدم
   `git revert <رقم-الـ-commit>`.

> ملاحظة: روابط الشجرة (`/tree/<commit>`) تبقى محفوظة على GitHub حتى لو حُذف النشر، فتصلح كنسخة مؤرشفة.