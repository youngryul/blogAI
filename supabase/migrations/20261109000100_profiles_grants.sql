-- profiles 테이블 권한/정책 복구
-- 증상: "permission denied for table profiles"
-- 원인: 로그인 사용자(authenticated 역할)에게 테이블 사용 권한(GRANT)이 없음.
-- 여러 번 실행해도 안전하도록 작성했습니다.

-- 1) 빠진 칸 채우기
alter table public.profiles
  add column if not exists email text,
  add column if not exists display_name text,
  add column if not exists naver_blog_id text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- 2) 테이블 사용 권한 (실제 접근 범위는 아래 RLS 정책이 본인 행으로 제한)
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;

-- 3) RLS: 본인 프로필만 읽기/쓰기
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- 4) Supabase API 가 바뀐 테이블 구조를 다시 읽도록
notify pgrst, 'reload schema';
