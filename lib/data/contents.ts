import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { ApiError, notFound } from "@/lib/api/errors"
import type {
  ContentBundle,
  ContentImageRow,
  ContentListItem,
  ContentReviewRow,
  ContentRow,
  ContentSectionRow,
  ContentStatus,
  ContentStrategyRow,
  GenerationStepRow,
  KeywordAnalysisRow,
  ProductAnalysisRow,
  ProductRow,
  PublishedPostRow,
} from "@/types"

function assertNoError(error: { message: string } | null, context: string): void {
  if (error) throw new ApiError(500, `${context}: ${error.message}`)
}

export async function getContent(supabase: SupabaseClient, id: string): Promise<ContentRow> {
  const { data, error } = await supabase.from("contents").select("*").eq("id", id).maybeSingle()
  assertNoError(error, "콘텐츠 조회 실패")
  if (!data) throw notFound("콘텐츠")
  return data as ContentRow
}

export async function getProduct(supabase: SupabaseClient, id: string): Promise<ProductRow> {
  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle()
  assertNoError(error, "상품 조회 실패")
  if (!data) throw notFound("상품")
  return data as ProductRow
}

export async function getSections(supabase: SupabaseClient, contentId: string): Promise<ContentSectionRow[]> {
  const { data, error } = await supabase
    .from("content_sections")
    .select("*")
    .eq("content_id", contentId)
    .order("sort_order", { ascending: true })
  assertNoError(error, "섹션 조회 실패")
  return (data ?? []) as ContentSectionRow[]
}

async function maybeById<T>(supabase: SupabaseClient, table: string, id: string | null): Promise<T | null> {
  if (!id) return null
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle()
  assertNoError(error, `${table} 조회 실패`)
  return (data as T) ?? null
}

/** 콘텐츠와 관련된 모든 단계 결과를 한 번에 조회 */
export async function loadContentBundle(supabase: SupabaseClient, id: string): Promise<ContentBundle> {
  const content = await getContent(supabase, id)

  const [product, productAnalysis, keywordAnalysis, strategy, sections, imagesRes, reviewRes, stepsRes, postsRes] =
    await Promise.all([
      getProduct(supabase, content.product_id),
      maybeById<ProductAnalysisRow>(supabase, "product_analyses", content.product_analysis_id),
      maybeById<KeywordAnalysisRow>(supabase, "keyword_analyses", content.keyword_analysis_id),
      maybeById<ContentStrategyRow>(supabase, "content_strategies", content.strategy_id),
      getSections(supabase, id),
      supabase.from("content_images").select("*").eq("content_id", id).order("created_at", { ascending: false }),
      supabase
        .from("content_reviews")
        .select("*")
        .eq("content_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("generation_steps").select("*").eq("content_id", id),
      supabase.from("published_posts").select("*").eq("content_id", id).order("published_at", { ascending: false }),
    ])

  assertNoError(imagesRes.error, "이미지 조회 실패")
  assertNoError(reviewRes.error, "검수 결과 조회 실패")
  assertNoError(stepsRes.error, "단계 상태 조회 실패")
  assertNoError(postsRes.error, "발행 기록 조회 실패")

  return {
    content,
    product,
    productAnalysis,
    keywordAnalysis,
    strategy,
    sections,
    images: (imagesRes.data ?? []) as ContentImageRow[],
    review: (reviewRes.data as ContentReviewRow | null) ?? null,
    steps: (stepsRes.data ?? []) as GenerationStepRow[],
    publishedPosts: (postsRes.data ?? []) as PublishedPostRow[],
  }
}

interface ContentListRow {
  id: string
  title: string | null
  status: ContentStatus
  quality_score: number | null
  created_at: string
  updated_at: string
  product: { id: string; name: string } | null
  keyword: { main_keyword: string } | null
}

export async function listContents(
  supabase: SupabaseClient,
  options: { status?: ContentStatus; limit?: number; offset?: number } = {},
): Promise<{ items: ContentListItem[]; total: number }> {
  const limit = options.limit ?? 20
  const offset = options.offset ?? 0
  let query = supabase
    .from("contents")
    .select(
      "id, title, status, quality_score, created_at, updated_at, product:products(id, name), keyword:keyword_analyses(main_keyword)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
  if (options.status) query = query.eq("status", options.status)

  const { data, error, count } = await query
  assertNoError(error, "콘텐츠 목록 조회 실패")
  return { items: (data ?? []) as unknown as ContentListRow[], total: count ?? 0 }
}

export interface DashboardStats {
  total: number
  thisMonth: number
  published: number
  drafts: number
}

export async function getDashboardStats(supabase: SupabaseClient): Promise<DashboardStats> {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const head = { count: "exact" as const, head: true }
  const [total, thisMonth, published, drafts] = await Promise.all([
    supabase.from("contents").select("id", head),
    supabase.from("contents").select("id", head).gte("created_at", monthStart.toISOString()),
    supabase.from("contents").select("id", head).eq("status", "published"),
    supabase.from("contents").select("id", head).in("status", ["draft", "generating"]),
  ])
  return {
    total: total.count ?? 0,
    thisMonth: thisMonth.count ?? 0,
    published: published.count ?? 0,
    drafts: drafts.count ?? 0,
  }
}
