-- 네이버 블로그 연결 (방문자 수 / 게시물 수 조회용)
-- 블로그 ID 만 저장한다. 네이버 로그인 정보(비밀번호, 쿠키)는 저장하지 않는다.
alter table public.profiles
  add column if not exists naver_blog_id text
    check (naver_blog_id is null or naver_blog_id ~ '^[A-Za-z0-9_-]{3,40}$');
