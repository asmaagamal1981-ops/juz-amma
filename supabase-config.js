/* ============================================================
   إعدادات Supabase العامة لتطبيق «رحلة حفظ جزء عمَّ»
   ------------------------------------------------------------
   ⚠️ املأ القيمتين من: Supabase Dashboard → Project Settings → API
      1) Project URL
      2) anon / publishable key  (وليس service_role أبدًا)

   🔐 ملاحظة أمنية مهمة:
   هذا الملف يُقدَّم للمتصفح، لذا لا يمكن إخفاء مفتاح anon؛
   فهو مفتاح «عام» مصمَّم للنشر (publishable). الحماية الحقيقية
   تأتي من Row Level Security في قاعدة البيانات (ملف
   supabase/schema.sql) وليس من إخفاء المفتاح.
   - لا تضع هنا مفتاح service_role أو أي مفتاح سري إطلاقًا.
   - لإدارة المشروع استخدم لوحة Supabase أو متغيرات CI سرّية.
   ============================================================ */
window.KIDS_SUPABASE = {
  url: 'https://mgzekoswpoojievmmldh.supabase.co',
  anonKey: 'sb_publishable__RUd6Id-WHAZKSm3IkiFzw_P6Op9IkR'
};
