-- 크롬 확장 프로그램 → 발행 완료 기록
-- 확장 프로그램이 블로그 자동 작성 후 사용자가 발행하면, 글 보기 주소를 읽어 이 함수로 기록합니다.
-- 20261109000300_blog_metrics.sql(extension_tokens) 다음에 실행하세요. 여러 번 실행해도 안전합니다.

create or replace function public.record_published_post(p_token text, p_content_id uuid, p_blog_url text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid;
  v_id uuid;
begin
  select user_id into v_user
  from public.extension_tokens
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');

  if v_user is null then
    raise exception 'invalid extension token' using errcode = '28000';
  end if;

  if p_blog_url is null or p_blog_url !~ '^https://(m\.)?blog\.naver\.com/[A-Za-z0-9_-]{3,40}/[0-9]{6,}$' then
    raise exception 'invalid blog url' using errcode = '22023';
  end if;

  -- 내 콘텐츠만
  if not exists (select 1 from public.contents where id = p_content_id and user_id = v_user) then
    raise exception 'content not found' using errcode = 'P0002';
  end if;

  update public.extension_tokens set last_used_at = now() where user_id = v_user;

  -- 같은 글 주소는 한 번만 기록
  select id into v_id from public.published_posts
  where user_id = v_user and content_id = p_content_id and blog_url = p_blog_url;

  if v_id is null then
    insert into public.published_posts (user_id, content_id, blog_url)
    values (v_user, p_content_id, p_blog_url)
    returning id into v_id;
  end if;

  update public.contents set status = 'published' where id = p_content_id and user_id = v_user;
  return v_id;
end;
$$;

revoke all on function public.record_published_post(text, uuid, text) from public;
grant execute on function public.record_published_post(text, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
