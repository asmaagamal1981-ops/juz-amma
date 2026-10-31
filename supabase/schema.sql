-- ============================================================
--  رحلة حفظ جزء عمَّ — مخطط قاعدة البيانات على Supabase
--  نفّذ هذا الملف كاملًا من: Supabase Dashboard → SQL Editor → New query
--  الملف آمن للتشغيل أكثر من مرة (idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- 1) جدول الملفات الشخصية (بيانات الحساب العامة)
-- ------------------------------------------------------------
create table if not exists public.kids_profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  login       text not null check (char_length(login) between 3 and 254),
  login_type  text not null default 'email' check (login_type in ('email', 'phone')),
  name        text not null check (char_length(name) between 2 and 30),
  avatar      text not null default '🦁' check (char_length(avatar) between 1 and 16),
  wird        smallint not null default 3 check (wird between 2 and 8),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- منع تكرار اسم الدخول (بريد أو هاتف) مع تجاهل حالة الأحرف
create unique index if not exists kids_profiles_login_uidx
  on public.kids_profiles (lower(login));

-- ------------------------------------------------------------
-- 2) جدول التقدم (وثيقة JSONB واحدة لكل طفل)
--    يحتوي: الأوراد، الاختبارات، النجوم، الأوسمة، الجوائز،
--    الشهادات، الأيام، والإعدادات.
-- ------------------------------------------------------------
create table if not exists public.kids_progress (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint kids_progress_data_size check (pg_column_size(data) <= 2097152)
);

-- ------------------------------------------------------------
-- 3) تحديث updated_at تلقائيًا
-- ------------------------------------------------------------
create or replace function public.kids_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kids_profiles_touch on public.kids_profiles;
create trigger kids_profiles_touch
  before update on public.kids_profiles
  for each row execute function public.kids_touch_updated_at();

drop trigger if exists kids_progress_touch on public.kids_progress;
create trigger kids_progress_touch
  before update on public.kids_progress
  for each row execute function public.kids_touch_updated_at();

-- ------------------------------------------------------------
-- 4) تشغيل Row Level Security
-- ------------------------------------------------------------
alter table public.kids_profiles enable row level security;
alter table public.kids_progress enable row level security;

-- لا وصول للزوار غير المسجّلين
revoke all on public.kids_profiles from public, anon;
revoke all on public.kids_progress from public, anon;
grant select, insert, update, delete on public.kids_profiles to authenticated;
grant select, insert, update, delete on public.kids_progress to authenticated;

-- ------------------------------------------------------------
-- 5) سياسات RLS: كل طفل يرى صفّه فقط
--    (select auth.uid()) تُحسّن الأداء عبر initplan
-- ------------------------------------------------------------
drop policy if exists kids_profiles_select_own on public.kids_profiles;
create policy kids_profiles_select_own
  on public.kids_profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists kids_profiles_insert_own on public.kids_profiles;
create policy kids_profiles_insert_own
  on public.kids_profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists kids_profiles_update_own on public.kids_profiles;
create policy kids_profiles_update_own
  on public.kids_profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists kids_profiles_delete_own on public.kids_profiles;
create policy kids_profiles_delete_own
  on public.kids_profiles for delete
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists kids_progress_select_own on public.kids_progress;
create policy kids_progress_select_own
  on public.kids_progress for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists kids_progress_insert_own on public.kids_progress;
create policy kids_progress_insert_own
  on public.kids_progress for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists kids_progress_update_own on public.kids_progress;
create policy kids_progress_update_own
  on public.kids_progress for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists kids_progress_delete_own on public.kids_progress;
create policy kids_progress_delete_own
  on public.kids_progress for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 6) حذف الحساب نهائيًا من داخل التطبيق
--    لا يستطيع العميل حذف صف من auth.users مباشرة، لذا نمنحه
--    دالة SECURITY DEFINER محدودة تحذف حسابه هو فقط.
-- ------------------------------------------------------------
create or replace function public.kids_delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- الحذف من auth.users يحذف الملف والتقدم تلقائيًا (on delete cascade)
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.kids_delete_account() from public, anon;
grant execute on function public.kids_delete_account() to authenticated;

comment on table public.kids_profiles is 'ملف كل طفل: الاسم والصورة والورد اليومي. محمي بـ RLS.';
comment on table public.kids_progress is 'تقدم كل طفل (JSONB) محمي بـ RLS، صف واحد لكل مستخدم.';

-- ------------------------------------------------------------
-- 7) تحقق سريع بعد التنفيذ
-- ------------------------------------------------------------
-- select tablename, rowsecurity from pg_tables
--  where schemaname = 'public' and tablename like 'kids_%';
