-- 브랜드 커넥트(쇼핑 커넥트) 상품 목록과 발급된 링크
-- 크롬 확장 프로그램이 "내가 연 브랜드 커넥트 화면"이 받은 응답에서 상품 목록(인기·추천·검색)과
-- 링크 발급 결과를 읽어 보냅니다. 새 콘텐츠 화면에서 바로 골라 글을 만들 때 씁니다.
-- 20261109000300_blog_metrics.sql 다음에 실행하세요. 여러 번 실행해도 안전합니다.

create table if not exists public.connect_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 브랜드 커넥트 응답의 상품 식별자(없으면 상품 URL/이름으로 만든 키)
  product_key text not null,
  name text not null,
  price numeric(14, 0),
  commission_rate numeric(6, 2),
  image_url text,
  product_url text,
  store_name text,
  category text,
  -- popular: 인기 순위 / recommended: 추천 / search: 검색·기타 목록
  source text not null default 'search' check (source in ('popular', 'recommended', 'search')),
  rank integer,
  affiliate_url text,
  link_issued_at timestamptz,
  -- 이 상품을 본 브랜드 커넥트 화면 주소 (링크 발급하러 갈 때 사용)
  page_url text,
  seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, product_key)
);

create index if not exists connect_products_user_seen_idx on public.connect_products (user_id, seen_at desc);

grant select on public.connect_products to authenticated;
alter table public.connect_products enable row level security;
drop policy if exists "connect_products_select_own" on public.connect_products;
create policy "connect_products_select_own" on public.connect_products
  for select to authenticated using (user_id = auth.uid());

-- 확장 프로그램 → 상품·링크 저장. 연결 코드로 사용자를 찾아 그 사용자 행만 쓴다.
-- p_products: [{"key","name","price","commissionRate","imageUrl","productUrl","storeName","category","source","rank","affiliateUrl","pageUrl"}]
-- p_links:    [{"key","affiliateUrl"}]  (링크 발급 응답에서 찾은 것)
create or replace function public.ingest_connect_products(p_token text, p_products jsonb, p_links jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid;
  v_products integer := 0;
  v_links integer := 0;
begin
  select user_id into v_user
  from public.extension_tokens
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');

  if v_user is null then
    raise exception 'invalid extension token' using errcode = '28000';
  end if;

  update public.extension_tokens set last_used_at = now() where user_id = v_user;

  if p_products is not null and jsonb_typeof(p_products) = 'array' then
    insert into public.connect_products as cp (
      user_id, product_key, name, price, commission_rate, image_url, product_url,
      store_name, category, source, rank, affiliate_url, link_issued_at, page_url, seen_at
    )
    select distinct on (p.key)
      v_user, left(p.key, 200), left(p.name, 300),
      case when p.price >= 0 and p.price < 1e12 then round(p.price) end,
      case when p."commissionRate" >= 0 and p."commissionRate" <= 100 then p."commissionRate" end,
      left(p."imageUrl", 1000), left(p."productUrl", 1000), left(p."storeName", 200), left(p.category, 300),
      case when p.source in ('popular', 'recommended', 'search') then p.source else 'search' end,
      case when p.rank between 1 and 10000 then p.rank end,
      left(p."affiliateUrl", 500),
      case when p."affiliateUrl" is not null then now() end,
      left(p."pageUrl", 1000), now()
    from jsonb_to_recordset(p_products) as p(
      key text, name text, price numeric, "commissionRate" numeric, "imageUrl" text, "productUrl" text,
      "storeName" text, category text, source text, rank integer, "affiliateUrl" text, "pageUrl" text
    )
    where coalesce(p.key, '') <> '' and coalesce(trim(p.name), '') <> ''
    limit 1000
    on conflict (user_id, product_key) do update set
      name = excluded.name,
      price = coalesce(excluded.price, cp.price),
      commission_rate = coalesce(excluded.commission_rate, cp.commission_rate),
      image_url = coalesce(excluded.image_url, cp.image_url),
      product_url = coalesce(excluded.product_url, cp.product_url),
      store_name = coalesce(excluded.store_name, cp.store_name),
      category = coalesce(excluded.category, cp.category),
      -- 인기 > 추천 > 검색 순으로 더 의미 있는 출처를 유지하되, 같은 출처면 최신 순위로 갱신
      source = case
        when excluded.source = 'search' and cp.source <> 'search' and cp.seen_at > now() - interval '7 days' then cp.source
        else excluded.source end,
      rank = case
        when excluded.source = 'search' and cp.source <> 'search' and cp.seen_at > now() - interval '7 days' then cp.rank
        else excluded.rank end,
      affiliate_url = coalesce(excluded.affiliate_url, cp.affiliate_url),
      link_issued_at = case when excluded.affiliate_url is not null and cp.affiliate_url is distinct from excluded.affiliate_url
        then now() else cp.link_issued_at end,
      page_url = coalesce(excluded.page_url, cp.page_url),
      seen_at = now();
    get diagnostics v_products = row_count;
  end if;

  if p_links is not null and jsonb_typeof(p_links) = 'array' then
    update public.connect_products cp
    set affiliate_url = l."affiliateUrl", link_issued_at = now()
    from (
      select distinct on (key) key, "affiliateUrl"
      from jsonb_to_recordset(p_links) as x(key text, "affiliateUrl" text)
      where coalesce(key, '') <> '' and "affiliateUrl" ~ '^https://'
      limit 200
    ) l
    where cp.user_id = v_user and cp.product_key = l.key
      and cp.affiliate_url is distinct from l."affiliateUrl";
    get diagnostics v_links = row_count;
  end if;

  return jsonb_build_object('products', v_products, 'links', v_links);
end;
$$;

revoke all on function public.ingest_connect_products(text, jsonb, jsonb) from public;
grant execute on function public.ingest_connect_products(text, jsonb, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
