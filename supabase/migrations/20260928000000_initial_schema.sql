-- =============================================================================
-- Blog AI (쇼핑 커넥트 블로그 콘텐츠 제작 도구) - initial schema
-- =============================================================================
-- 모든 사용자 데이터 테이블은 user_id 컬럼을 가지며 RLS 로 본인 데이터만 접근할 수 있다.
-- 하위 테이블(content_sections 등)은 부모 레코드의 소유권까지 함께 검사한다.

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 회원가입 시 profile 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  category text,
  price numeric(14, 0),
  product_url text,
  affiliate_url text,
  description text,
  features jsonb not null default '[]'::jsonb,
  target_reader text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_user_id_idx on public.products (user_id, created_at desc);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- product_analyses (STEP 1 결과)
-- -----------------------------------------------------------------------------
create table public.product_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index product_analyses_product_id_idx on public.product_analyses (product_id, created_at desc);

-- -----------------------------------------------------------------------------
-- keyword_analyses (STEP 2~3 결과)
-- -----------------------------------------------------------------------------
create table public.keyword_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  main_keyword text not null,
  secondary_keywords jsonb not null default '[]'::jsonb,
  longtail_keywords jsonb not null default '[]'::jsonb,
  search_intent text,
  search_intent_type text check (search_intent_type in ('informational', 'commercial', 'transactional')),
  target_reader text,
  user_questions jsonb not null default '[]'::jsonb,
  article_angles jsonb not null default '[]'::jsonb,
  -- 외부 데이터 provider(네이버 검색광고/데이터랩 등) 지표 확장용
  provider text not null default 'ai',
  metrics jsonb,
  created_at timestamptz not null default now()
);

create index keyword_analyses_product_id_idx on public.keyword_analyses (product_id, created_at desc);

-- -----------------------------------------------------------------------------
-- content_strategies (STEP 4 결과)
-- -----------------------------------------------------------------------------
create table public.content_strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  keyword_analysis_id uuid references public.keyword_analyses (id) on delete set null,
  primary_angle text,
  target_reader text,
  reader_problem text,
  article_goal text,
  recommended_length integer,
  recommended_image_count integer,
  section_plan jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index content_strategies_product_id_idx on public.content_strategies (product_id, created_at desc);

-- -----------------------------------------------------------------------------
-- contents
-- -----------------------------------------------------------------------------
create table public.contents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  product_analysis_id uuid references public.product_analyses (id) on delete set null,
  keyword_analysis_id uuid references public.keyword_analyses (id) on delete set null,
  strategy_id uuid references public.content_strategies (id) on delete set null,

  -- 생성 옵션
  content_type text not null default 'informational'
    check (content_type in ('informational', 'recommendation', 'comparison', 'buying_guide', 'review')),
  main_keyword_input text,
  target_reader text,
  brand_tone text,
  length_option text not null default 'normal' check (length_option in ('short', 'normal', 'long')),
  cta_strength text not null default 'normal' check (cta_strength in ('weak', 'normal', 'strong')),
  max_affiliate_links integer not null default 2 check (max_affiliate_links between 1 and 5),

  -- 생성 결과
  title_candidates jsonb not null default '[]'::jsonb,
  title text,
  intro text,
  conclusion text,
  disclosure text,
  disclosure_position text not null default 'top' check (disclosure_position in ('top', 'bottom')),
  hashtags jsonb not null default '[]'::jsonb,

  status text not null default 'draft' check (status in ('draft', 'generating', 'completed', 'published')),
  quality_score integer check (quality_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contents_user_id_idx on public.contents (user_id, created_at desc);
create index contents_user_status_idx on public.contents (user_id, status);

create trigger contents_set_updated_at
  before update on public.contents
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- content_sections
-- -----------------------------------------------------------------------------
create table public.content_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content_id uuid not null references public.contents (id) on delete cascade,
  sort_order integer not null default 0,
  heading text not null default '',
  body text not null default '',
  image_kind text check (image_kind in ('hero', 'explain', 'usage', 'summary')),
  image_prompt text,
  image_url text,
  insert_affiliate_link boolean not null default false,
  cta_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_sections_content_id_idx on public.content_sections (content_id, sort_order);

create trigger content_sections_set_updated_at
  before update on public.content_sections
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- content_images
-- -----------------------------------------------------------------------------
create table public.content_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content_id uuid not null references public.contents (id) on delete cascade,
  section_id uuid references public.content_sections (id) on delete set null,
  kind text,
  prompt text not null,
  image_url text not null,
  storage_path text,
  model text,
  created_at timestamptz not null default now()
);

create index content_images_content_id_idx on public.content_images (content_id, created_at desc);

-- -----------------------------------------------------------------------------
-- content_reviews
-- -----------------------------------------------------------------------------
create table public.content_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content_id uuid not null references public.contents (id) on delete cascade,
  score integer not null check (score between 0 and 100),
  issues jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index content_reviews_content_id_idx on public.content_reviews (content_id, created_at desc);

-- -----------------------------------------------------------------------------
-- published_posts
-- -----------------------------------------------------------------------------
create table public.published_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content_id uuid not null references public.contents (id) on delete cascade,
  blog_url text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index published_posts_content_id_idx on public.published_posts (content_id);

-- -----------------------------------------------------------------------------
-- generation_steps: 파이프라인 단계별 상태 (실패 단계만 재실행하기 위함)
-- -----------------------------------------------------------------------------
create table public.generation_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content_id uuid not null references public.contents (id) on delete cascade,
  step text not null check (step in (
    'product_analysis', 'keyword_analysis', 'content_strategy', 'titles', 'blog',
    'image_prompts', 'images', 'affiliate_links', 'review', 'finalize'
  )),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'skipped')),
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (content_id, step)
);

create trigger generation_steps_set_updated_at
  before update on public.generation_steps
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ai_usage: 비용 추적
-- -----------------------------------------------------------------------------
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content_id uuid references public.contents (id) on delete set null,
  action text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  image_count integer not null default 0,
  estimated_cost numeric(12, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index ai_usage_user_id_idx on public.ai_usage (user_id, created_at desc);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_analyses enable row level security;
alter table public.keyword_analyses enable row level security;
alter table public.content_strategies enable row level security;
alter table public.contents enable row level security;
alter table public.content_sections enable row level security;
alter table public.content_images enable row level security;
alter table public.content_reviews enable row level security;
alter table public.published_posts enable row level security;
alter table public.generation_steps enable row level security;
alter table public.ai_usage enable row level security;

-- profiles: 본인 프로필만
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- products
create policy "products_all_own" on public.products
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- product 하위 테이블: 본인 소유 + 부모 product 도 본인 소유
create policy "product_analyses_all_own" on public.product_analyses
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.products p where p.id = product_id and p.user_id = auth.uid())
  );

create policy "keyword_analyses_all_own" on public.keyword_analyses
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.products p where p.id = product_id and p.user_id = auth.uid())
  );

create policy "content_strategies_all_own" on public.content_strategies
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.products p where p.id = product_id and p.user_id = auth.uid())
  );

-- contents
create policy "contents_all_own" on public.contents
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.products p where p.id = product_id and p.user_id = auth.uid())
  );

-- content 하위 테이블
create policy "content_sections_all_own" on public.content_sections
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.contents c where c.id = content_id and c.user_id = auth.uid())
  );

create policy "content_images_all_own" on public.content_images
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.contents c where c.id = content_id and c.user_id = auth.uid())
  );

create policy "content_reviews_all_own" on public.content_reviews
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.contents c where c.id = content_id and c.user_id = auth.uid())
  );

create policy "published_posts_all_own" on public.published_posts
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.contents c where c.id = content_id and c.user_id = auth.uid())
  );

create policy "generation_steps_all_own" on public.generation_steps
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.contents c where c.id = content_id and c.user_id = auth.uid())
  );

-- ai_usage: 본인 기록 조회/추가만 (수정·삭제 불가)
create policy "ai_usage_select_own" on public.ai_usage
  for select using (user_id = auth.uid());
create policy "ai_usage_insert_own" on public.ai_usage
  for insert with check (user_id = auth.uid());

-- =============================================================================
-- Storage
-- =============================================================================
-- 블로그에 붙여넣을 이미지는 외부에서 접근 가능해야 하므로 public bucket 을 사용한다.
-- 업로드/수정/삭제는 `{user_id}/...` 경로의 본인 폴더에만 허용한다.
insert into storage.buckets (id, name, public)
values
  ('content-images', 'content-images', true),
  ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "blogai_storage_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('content-images', 'product-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "blogai_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('content-images', 'product-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "blogai_storage_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('content-images', 'product-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "blogai_storage_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('content-images', 'product-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
