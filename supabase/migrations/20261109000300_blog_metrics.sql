-- 크롬 확장 프로그램이 보내는 블로그 지표(방문자 수, 애드포스트·커넥트 수익)
-- 확장 프로그램은 로그인 세션 대신 "연결 코드"로 인증합니다.
-- 연결 코드는 해시만 저장하고, 원문은 만들 때 한 번만 보여줍니다. 여러 번 실행해도 안전합니다.

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 지표 테이블
-- -----------------------------------------------------------------------------
create table if not exists public.blog_metrics (
  user_id uuid not null references auth.users (id) on delete cascade,
  metric_date date not null,
  kind text not null check (kind in ('visitors', 'adpost', 'connect')),
  value numeric(14, 2) not null check (value >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, metric_date, kind)
);

grant select on public.blog_metrics to authenticated;
alter table public.blog_metrics enable row level security;
drop policy if exists "blog_metrics_select_own" on public.blog_metrics;
create policy "blog_metrics_select_own" on public.blog_metrics
  for select to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 확장 프로그램 연결 코드 (사용자당 1개)
-- -----------------------------------------------------------------------------
create table if not exists public.extension_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

grant select on public.extension_tokens to authenticated;
alter table public.extension_tokens enable row level security;
drop policy if exists "extension_tokens_select_own" on public.extension_tokens;
create policy "extension_tokens_select_own" on public.extension_tokens
  for select to authenticated using (user_id = auth.uid());

-- 연결 코드 발급(기존 코드는 무효화). 원문은 반환값으로 한 번만 전달된다.
create or replace function public.create_extension_token()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_token text;
begin
  if v_user is null then
    raise exception 'login required';
  end if;
  v_token := 'cn_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.extension_tokens (user_id, token_hash, created_at, last_used_at)
  values (v_user, encode(extensions.digest(v_token, 'sha256'), 'hex'), now(), null)
  on conflict (user_id) do update
    set token_hash = excluded.token_hash, created_at = now(), last_used_at = null;
  return v_token;
end;
$$;

create or replace function public.revoke_extension_token()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.extension_tokens where user_id = auth.uid();
$$;

-- 확장 프로그램 → 지표 저장. 연결 코드로 사용자를 찾아 그 사용자 행만 쓴다.
-- p_metrics: [{"date":"2026-11-08","kind":"visitors","value":123}, ...]
create or replace function public.ingest_blog_metrics(p_token text, p_metrics jsonb)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid;
  v_count integer;
begin
  select user_id into v_user
  from public.extension_tokens
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');

  if v_user is null then
    raise exception 'invalid extension token' using errcode = '28000';
  end if;

  update public.extension_tokens set last_used_at = now() where user_id = v_user;

  if p_metrics is null or jsonb_typeof(p_metrics) <> 'array' then
    return 0;
  end if;

  insert into public.blog_metrics (user_id, metric_date, kind, value, updated_at)
  select distinct on (m.date, m.kind) v_user, m.date, m.kind, m.value, now()
  from jsonb_to_recordset(p_metrics) as m(date date, kind text, value numeric)
  where m.kind in ('visitors', 'adpost', 'connect')
    and m.value is not null and m.value >= 0 and m.value < 1e12
    and m.date between current_date - 400 and current_date + 1
  limit 2000
  on conflict (user_id, metric_date, kind) do update
    set value = excluded.value, updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.create_extension_token() from public, anon;
revoke all on function public.revoke_extension_token() from public, anon;
revoke all on function public.ingest_blog_metrics(text, jsonb) from public;
grant execute on function public.create_extension_token() to authenticated;
grant execute on function public.revoke_extension_token() to authenticated;
grant execute on function public.ingest_blog_metrics(text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
