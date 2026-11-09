-- 커넥트노트 전용 사용자 설정 테이블
-- profiles 테이블은 같은 Supabase 프로젝트의 다른 서비스와 함께 쓰고 있어(nickname 필수 등 구조가 다름)
-- 블로그 연결 정보는 이 앱 전용 테이블에 따로 저장합니다. 여러 번 실행해도 안전합니다.

create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  naver_blog_id text check (naver_blog_id is null or naver_blog_id ~ '^[A-Za-z0-9_-]{3,40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.user_settings to authenticated;

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own" on public.user_settings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

notify pgrst, 'reload schema';
