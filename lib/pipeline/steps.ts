import "server-only"

import { generateImage, generateStructured, type AICallContext, type ReferenceImage } from "@/lib/ai/client"
import {
  mockBlogDraft,
  mockContentStrategy,
  mockImagePlan,
  mockKeywordAnalysis,
  mockProductAnalysis,
  mockRegeneratedSection,
  mockReview,
  mockTitles,
} from "@/lib/ai/mock"
import {
  buildFinalImagePrompt,
  createBlogPrompt,
  createContentReviewPrompt,
  createContentStrategyPrompt,
  createImagePromptPlanPrompt,
  createKeywordAnalysisPrompt,
  createProductAnalysisPrompt,
  createSectionRegenerationPrompt,
  createTitlePrompt,
  toProductFacts,
} from "@/lib/ai/prompts"
import {
  blogDraftSchema,
  contentStrategySchema,
  imagePromptPlanSchema,
  keywordAnalysisSchema,
  productAnalysisSchema,
  regeneratedSectionSchema,
  reviewEvaluationSchema,
  reviewResultSchema,
  titleCandidatesSchema,
} from "@/lib/ai/schemas"
import { ApiError, badRequest } from "@/lib/api/errors"
import {
  DEFAULT_DISCLOSURE,
  DEFAULT_IMAGE_COUNT,
  LENGTH_TARGETS,
  STORAGE_BUCKETS,
} from "@/lib/constants"
import { buildFinalContent, defaultCtaText, normalizeHashtag, toBlogContent, type FinalContent } from "@/lib/content/format"
import { lintContent, mergeIssues } from "@/lib/content/lint"
import { findProductImage } from "@/lib/content/product-image"
import { getContent, getProduct, getSections, loadContentBundle } from "@/lib/data/contents"
import { getKeywordProvider } from "@/lib/keywords/provider"
import { PIPELINE_STEPS } from "@/types"
import type {
  ContentImageRow,
  ContentReviewRow,
  ContentRow,
  ContentSectionRow,
  ContentStrategy,
  ContentStrategyRow,
  KeywordAnalysis,
  KeywordAnalysisRow,
  PipelineStep,
  ProductAnalysis,
  ProductAnalysisRow,
  ProductRow,
  ReviewMetricsJson,
  StepStatus,
  TitleCandidate,
} from "@/types"

export interface StepContext extends AICallContext {
  contentId: string
}

// ---------------------------------------------------------------------------
// Step status helpers
// ---------------------------------------------------------------------------
async function setStepStatus(ctx: StepContext, step: PipelineStep, status: StepStatus, error?: string | null) {
  const now = new Date().toISOString()
  const { error: dbError } = await ctx.supabase.from("generation_steps").upsert(
    {
      user_id: ctx.userId,
      content_id: ctx.contentId,
      step,
      status,
      error: error ?? null,
      ...(status === "processing" ? { started_at: now, completed_at: null } : {}),
      ...(status === "completed" || status === "skipped" ? { completed_at: now } : {}),
    },
    { onConflict: "content_id,step" },
  )
  if (dbError) console.warn(`[pipeline] failed to update step ${step}:`, dbError.message)
}

/** 지정 단계 이후의 단계를 pending 으로 되돌린다 (앞 단계를 재생성했을 때) */
async function resetStepsAfter(ctx: StepContext, step: PipelineStep) {
  const later = PIPELINE_STEPS.slice(PIPELINE_STEPS.indexOf(step) + 1)
  if (!later.length) return
  await ctx.supabase
    .from("generation_steps")
    .update({ status: "pending", error: null, started_at: null, completed_at: null })
    .eq("content_id", ctx.contentId)
    .in("step", later)
    .neq("status", "pending")
}

async function markGenerating(ctx: StepContext) {
  await ctx.supabase.from("contents").update({ status: "generating" }).eq("id", ctx.contentId).eq("status", "draft")
}

/** 단계 실행 래퍼: processing → completed / failed 상태를 기록한다. */
export async function runStep<T>(ctx: StepContext, step: PipelineStep, fn: () => Promise<T>): Promise<T> {
  await setStepStatus(ctx, step, "processing")
  await markGenerating(ctx)
  try {
    const result = await fn()
    await setStepStatus(ctx, step, "completed")
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await setStepStatus(ctx, step, "failed", message)
    throw error
  }
}

async function updateContent(ctx: StepContext, patch: Partial<ContentRow>): Promise<ContentRow> {
  const { data, error } = await ctx.supabase.from("contents").update(patch).eq("id", ctx.contentId).select("*").single()
  if (error) throw new ApiError(500, `콘텐츠 저장 실패: ${error.message}`)
  return data as ContentRow
}

// ---------------------------------------------------------------------------
// Row → AI type converters
// ---------------------------------------------------------------------------
function toKeywordAnalysis(row: KeywordAnalysisRow): KeywordAnalysis {
  return {
    mainKeyword: row.main_keyword,
    secondaryKeywords: row.secondary_keywords ?? [],
    longtailKeywords: row.longtail_keywords ?? [],
    searchIntent: row.search_intent ?? "",
    searchIntentType: row.search_intent_type ?? "informational",
    targetReader: row.target_reader ?? "",
    userQuestions: row.user_questions ?? [],
    articleAngles: row.article_angles ?? [],
  }
}

function toContentStrategy(row: ContentStrategyRow): ContentStrategy {
  return {
    primaryAngle: row.primary_angle ?? "",
    targetReader: row.target_reader ?? "",
    readerProblem: row.reader_problem ?? "",
    articleGoal: row.article_goal ?? "",
    recommendedLength: row.recommended_length ?? 2500,
    recommendedImageCount: row.recommended_image_count ?? DEFAULT_IMAGE_COUNT,
    sectionPlan: row.section_plan ?? [],
  }
}

async function requireProductAnalysis(ctx: StepContext, content: ContentRow): Promise<ProductAnalysis> {
  if (!content.product_analysis_id) throw badRequest("상품 분석 단계가 먼저 완료되어야 합니다.")
  const { data } = await ctx.supabase.from("product_analyses").select("*").eq("id", content.product_analysis_id).single()
  if (!data) throw badRequest("상품 분석 결과를 찾을 수 없습니다.")
  return (data as ProductAnalysisRow).result
}

async function requireKeywordAnalysis(ctx: StepContext, content: ContentRow): Promise<KeywordAnalysis> {
  if (!content.keyword_analysis_id) throw badRequest("키워드 분석 단계가 먼저 완료되어야 합니다.")
  const { data } = await ctx.supabase.from("keyword_analyses").select("*").eq("id", content.keyword_analysis_id).single()
  if (!data) throw badRequest("키워드 분석 결과를 찾을 수 없습니다.")
  return toKeywordAnalysis(data as KeywordAnalysisRow)
}

async function requireStrategy(ctx: StepContext, content: ContentRow): Promise<ContentStrategy> {
  if (!content.strategy_id) throw badRequest("콘텐츠 전략 단계가 먼저 완료되어야 합니다.")
  const { data } = await ctx.supabase.from("content_strategies").select("*").eq("id", content.strategy_id).single()
  if (!data) throw badRequest("콘텐츠 전략을 찾을 수 없습니다.")
  return toContentStrategy(data as ContentStrategyRow)
}

function imageCountFor(strategy: ContentStrategy | null): number {
  const count = strategy?.recommendedImageCount ?? DEFAULT_IMAGE_COUNT
  return Math.min(6, Math.max(1, count))
}

// ---------------------------------------------------------------------------
// STEP 1. 상품 분석
// ---------------------------------------------------------------------------
export async function runProductAnalysis(ctx: StepContext): Promise<ProductAnalysisRow> {
  return runStep(ctx, "product_analysis", async () => {
    const content = await getContent(ctx.supabase, ctx.contentId)
    const product = await getProduct(ctx.supabase, content.product_id)
    const facts = toProductFacts(product)

    const result = await generateStructured({
      ctx,
      action: "product_analysis",
      schema: productAnalysisSchema,
      schemaName: "product_analysis",
      prompt: createProductAnalysisPrompt({ product: facts }),
      mock: () => mockProductAnalysis(facts),
    })

    const { data, error } = await ctx.supabase
      .from("product_analyses")
      .insert({ user_id: ctx.userId, product_id: product.id, result })
      .select("*")
      .single()
    if (error) throw new ApiError(500, `상품 분석 저장 실패: ${error.message}`)

    await updateContent(ctx, { product_analysis_id: data.id })
    await resetStepsAfter(ctx, "product_analysis")
    return data as ProductAnalysisRow
  })
}

// ---------------------------------------------------------------------------
// STEP 2~3. 키워드 + 검색 의도 분석
// ---------------------------------------------------------------------------
export async function runKeywordAnalysis(ctx: StepContext): Promise<KeywordAnalysisRow> {
  return runStep(ctx, "keyword_analysis", async () => {
    const content = await getContent(ctx.supabase, ctx.contentId)
    const product = await getProduct(ctx.supabase, content.product_id)
    const analysis = await requireProductAnalysis(ctx, content)
    const facts = toProductFacts(product)
    const fixedKeyword = content.main_keyword_input?.trim() || null

    const result = await generateStructured({
      ctx,
      action: "keyword_analysis",
      schema: keywordAnalysisSchema,
      schemaName: "keyword_analysis",
      prompt: createKeywordAnalysisPrompt({
        product: facts,
        analysis,
        contentType: content.content_type,
        mainKeywordInput: fixedKeyword,
        targetReader: content.target_reader,
        externalMetrics: null,
      }),
      mock: () => mockKeywordAnalysis(facts, fixedKeyword),
      validate: (value) =>
        fixedKeyword && value.mainKeyword.trim() !== fixedKeyword
          ? `mainKeyword 는 반드시 사용자가 지정한 "${fixedKeyword}" 여야 합니다.`
          : null,
    })
    if (fixedKeyword) result.mainKeyword = fixedKeyword

    // 외부 키워드 데이터 provider (MVP: AI provider — 정량 데이터 없음)
    const provider = getKeywordProvider()
    const metrics = await provider.analyze(result.mainKeyword).catch((error: unknown) => ({
      keyword: result.mainKeyword,
      source: provider.name,
      error: error instanceof Error ? error.message : String(error),
    }))

    const { data, error } = await ctx.supabase
      .from("keyword_analyses")
      .insert({
        user_id: ctx.userId,
        product_id: product.id,
        main_keyword: result.mainKeyword,
        secondary_keywords: result.secondaryKeywords,
        longtail_keywords: result.longtailKeywords,
        search_intent: result.searchIntent,
        search_intent_type: result.searchIntentType,
        target_reader: result.targetReader,
        user_questions: result.userQuestions,
        article_angles: result.articleAngles,
        provider: provider.name,
        metrics,
      })
      .select("*")
      .single()
    if (error) throw new ApiError(500, `키워드 분석 저장 실패: ${error.message}`)

    await updateContent(ctx, { keyword_analysis_id: data.id })
    await resetStepsAfter(ctx, "keyword_analysis")
    return data as KeywordAnalysisRow
  })
}

// ---------------------------------------------------------------------------
// STEP 4. 콘텐츠 전략 (구조)
// ---------------------------------------------------------------------------
export async function runContentStrategy(ctx: StepContext): Promise<ContentStrategyRow> {
  return runStep(ctx, "content_strategy", async () => {
    const content = await getContent(ctx.supabase, ctx.contentId)
    const product = await getProduct(ctx.supabase, content.product_id)
    const analysis = await requireProductAnalysis(ctx, content)
    const keywords = await requireKeywordAnalysis(ctx, content)
    const facts = toProductFacts(product)
    const target = LENGTH_TARGETS[content.length_option]

    const result = await generateStructured({
      ctx,
      action: "content_strategy",
      schema: contentStrategySchema,
      schemaName: "content_strategy",
      prompt: createContentStrategyPrompt({
        product: facts,
        analysis,
        keywords,
        contentType: content.content_type,
        lengthOption: content.length_option,
        targetChars: target.chars,
        sectionCount: target.sections,
        imageCount: DEFAULT_IMAGE_COUNT,
        targetReader: content.target_reader,
        brandTone: content.brand_tone,
      }),
      mock: () => mockContentStrategy(facts, keywords, target.sections, target.chars, DEFAULT_IMAGE_COUNT),
      validate: (value) =>
        value.sectionPlan.length < 3 ? "sectionPlan 은 최소 3개 이상의 섹션이어야 합니다." : null,
    })

    const { data, error } = await ctx.supabase
      .from("content_strategies")
      .insert({
        user_id: ctx.userId,
        product_id: product.id,
        keyword_analysis_id: content.keyword_analysis_id,
        primary_angle: result.primaryAngle,
        target_reader: result.targetReader,
        reader_problem: result.readerProblem,
        article_goal: result.articleGoal,
        recommended_length: result.recommendedLength,
        recommended_image_count: result.recommendedImageCount,
        section_plan: result.sectionPlan,
      })
      .select("*")
      .single()
    if (error) throw new ApiError(500, `콘텐츠 전략 저장 실패: ${error.message}`)

    await updateContent(ctx, { strategy_id: data.id })
    await resetStepsAfter(ctx, "content_strategy")
    return data as ContentStrategyRow
  })
}

// ---------------------------------------------------------------------------
// 제목 후보
// ---------------------------------------------------------------------------
const TITLE_COUNT = 5
const BANNED_TITLE_PATTERNS = /(!!|\?\?|★|☆|♥|【|】|충격|경악|역대급|무조건|최저가|내돈내산|솔직후기|써보니)/

export async function runTitles(ctx: StepContext): Promise<TitleCandidate[]> {
  return runStep(ctx, "titles", async () => {
    const content = await getContent(ctx.supabase, ctx.contentId)
    const product = await getProduct(ctx.supabase, content.product_id)
    const keywords = await requireKeywordAnalysis(ctx, content)
    const strategy = await requireStrategy(ctx, content)

    const result = await generateStructured({
      ctx,
      action: "titles",
      schema: titleCandidatesSchema,
      schemaName: "title_candidates",
      prompt: createTitlePrompt({
        productName: product.name,
        price: product.price,
        keywords,
        strategy,
        contentType: content.content_type,
        count: TITLE_COUNT,
      }),
      mock: () => ({ titles: mockTitles(keywords, TITLE_COUNT) }),
      validate: (value) => {
        if (value.titles.length < TITLE_COUNT) return `제목은 최소 ${TITLE_COUNT}개가 필요합니다.`
        const banned = value.titles.filter((t) => BANNED_TITLE_PATTERNS.test(t.title))
        if (banned.length) return `금지 표현이 들어간 제목이 있습니다: ${banned.map((t) => t.title).join(" / ")}`
        return null
      },
    })

    const titles = result.titles.map((t) => ({ ...t, title: t.title.trim() }))
    await updateContent(ctx, { title_candidates: titles })
    return titles
  })
}

// ---------------------------------------------------------------------------
// STEP 5. 블로그 본문
// ---------------------------------------------------------------------------
export async function runBlog(ctx: StepContext, options: { title?: string | null } = {}): Promise<ContentSectionRow[]> {
  if (options.title?.trim()) {
    await updateContent(ctx, { title: options.title.trim() })
  }

  return runStep(ctx, "blog", async () => {
    const content = await getContent(ctx.supabase, ctx.contentId)
    if (!content.title?.trim()) throw badRequest("제목을 먼저 선택하세요.")
    const product = await getProduct(ctx.supabase, content.product_id)
    const analysis = await requireProductAnalysis(ctx, content)
    const keywords = await requireKeywordAnalysis(ctx, content)
    const strategy = await requireStrategy(ctx, content)
    const facts = toProductFacts(product)
    const target = LENGTH_TARGETS[content.length_option]

    const draft = await generateStructured({
      ctx,
      action: "blog",
      schema: blogDraftSchema,
      schemaName: "blog_draft",
      prompt: createBlogPrompt({
        product: facts,
        analysis,
        keywords,
        strategy,
        title: content.title,
        contentType: content.content_type,
        brandTone: content.brand_tone,
        lengthOption: content.length_option,
        targetChars: strategy.recommendedLength || target.chars,
        ctaStrength: content.cta_strength,
        maxAffiliateLinks: content.max_affiliate_links,
      }),
      mock: () => mockBlogDraft(facts, keywords, strategy, content.max_affiliate_links),
      validate: (value) => (value.sections.length < 3 ? "본문 섹션은 최소 3개 이상이어야 합니다." : null),
    })

    // 기존 섹션 교체
    const { error: deleteError } = await ctx.supabase.from("content_sections").delete().eq("content_id", ctx.contentId)
    if (deleteError) throw new ApiError(500, `기존 섹션 삭제 실패: ${deleteError.message}`)

    const { data, error } = await ctx.supabase
      .from("content_sections")
      .insert(
        draft.sections.map((section, index) => ({
          user_id: ctx.userId,
          content_id: ctx.contentId,
          sort_order: index,
          heading: section.heading.trim(),
          body: section.body.trim(),
          insert_affiliate_link: section.insertAffiliateLink,
        })),
      )
      .select("*")
    if (error) throw new ApiError(500, `섹션 저장 실패: ${error.message}`)

    await updateContent(ctx, {
      intro: draft.intro.trim(),
      conclusion: draft.conclusion.trim(),
      hashtags: Array.from(new Set(draft.hashtags.map(normalizeHashtag).filter(Boolean))).slice(0, 12),
    })
    await resetStepsAfter(ctx, "blog")
    return ((data ?? []) as ContentSectionRow[]).sort((a, b) => a.sort_order - b.sort_order)
  })
}

// ---------------------------------------------------------------------------
// STEP 6. 이미지 프롬프트
// ---------------------------------------------------------------------------
export async function runImagePrompts(ctx: StepContext): Promise<ContentSectionRow[]> {
  return runStep(ctx, "image_prompts", async () => {
    const content = await getContent(ctx.supabase, ctx.contentId)
    const product = await ensureProductImage(ctx, await getProduct(ctx.supabase, content.product_id))
    const sections = await getSections(ctx.supabase, ctx.contentId)
    if (!sections.length) throw badRequest("본문이 먼저 생성되어야 합니다.")
    const strategy = content.strategy_id ? await requireStrategy(ctx, content) : null
    const imageCount = Math.min(imageCountFor(strategy), sections.length)
    const facts = toProductFacts(product)
    const sectionSummaries = sections.map((s, index) => ({
      index,
      heading: s.heading,
      excerpt: s.body.replace(/\s+/g, " ").slice(0, 160),
    }))

    const plan = await generateStructured({
      ctx,
      action: "image_prompts",
      schema: imagePromptPlanSchema,
      schemaName: "image_prompt_plan",
      prompt: createImagePromptPlanPrompt({
        productName: product.name,
        category: product.category,
        productDescription: product.description,
        hasProductImage: facts.hasImage,
        title: content.title ?? "",
        sections: sectionSummaries,
        imageCount,
      }),
      mock: () => mockImagePlan(facts, sectionSummaries, imageCount),
      validate: (value) => {
        const invalid = value.images.some((img) => img.sectionIndex < 0 || img.sectionIndex >= sections.length)
        if (invalid) return `sectionIndex 는 0 ~ ${sections.length - 1} 범위여야 합니다.`
        if (value.images.length === 0) return "최소 1개의 이미지를 계획해야 합니다."
        return null
      },
    })

    // 섹션당 1개 이미지, 최대 imageCount 개
    const bySection = new Map<number, (typeof plan.images)[number]>()
    for (const image of plan.images) {
      if (!bySection.has(image.sectionIndex) && bySection.size < imageCount) bySection.set(image.sectionIndex, image)
    }

    const updates = sections.map((section, index) => {
      const planned = bySection.get(index)
      return ctx.supabase
        .from("content_sections")
        .update({
          image_prompt: planned ? planned.prompt : null,
          image_kind: planned ? planned.kind : null,
          // 프롬프트가 바뀌면 기존 이미지는 유지하되, 이미지가 필요 없는 섹션은 비운다
          ...(planned ? {} : { image_url: null }),
        })
        .eq("id", section.id)
    })
    const results = await Promise.all(updates)
    const failed = results.find((r) => r.error)
    if (failed?.error) throw new ApiError(500, `이미지 프롬프트 저장 실패: ${failed.error.message}`)

    await resetStepsAfter(ctx, "image_prompts")
    return getSections(ctx.supabase, ctx.contentId)
  })
}

// ---------------------------------------------------------------------------
// STEP 7. 이미지 생성 (요청당 1장 — 서버리스 타임아웃 회피)
// ---------------------------------------------------------------------------
export interface ImageGenerationResult {
  section: ContentSectionRow | null
  image: ContentImageRow | null
  remaining: number
}

async function countRemainingImages(ctx: StepContext): Promise<number> {
  const sections = await getSections(ctx.supabase, ctx.contentId)
  return sections.filter((s) => s.image_prompt && !s.image_url).length
}

/**
 * 상품 대표 이미지가 비어 있으면 ① 같은 상품의 브랜드 커넥트 수집 이미지 ② 상품 URL·커넥트 링크 페이지의 og:image
 * 순으로 찾아 상품에 저장한다. 한 번 찾으면 다음 글부터는 바로 재사용되고 상품 화면에도 보인다.
 */
async function ensureProductImage(ctx: StepContext, product: ProductRow): Promise<ProductRow> {
  if (product.image_url?.trim()) return product

  let imageUrl: string | null = null
  if (product.product_url || product.affiliate_url) {
    const { data } = await ctx.supabase
      .from("connect_products")
      .select("image_url")
      .or(
        [
          product.product_url ? `product_url.eq."${product.product_url}"` : null,
          product.affiliate_url ? `affiliate_url.eq."${product.affiliate_url}"` : null,
        ]
          .filter(Boolean)
          .join(","),
      )
      .not("image_url", "is", null)
      .limit(1)
      .maybeSingle()
    imageUrl = (data as { image_url: string | null } | null)?.image_url ?? null
  }
  imageUrl ??= await findProductImage(product)
  if (!imageUrl) return product

  const { error } = await ctx.supabase.from("products").update({ image_url: imageUrl }).eq("id", product.id)
  if (error) console.warn("[image] 상품 대표 이미지 저장 실패", error.message)
  return { ...product, image_url: imageUrl }
}

/** 상품 대표 이미지를 내려받는다. 실패하거나 너무 크면 null (참조 없이 생성) */
async function fetchReferenceImage(url: string | null | undefined): Promise<ReferenceImage | null> {
  if (!url?.trim()) return null
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) return null
    const contentType = response.headers.get("content-type")?.split(";")[0].trim() ?? "image/jpeg"
    if (!/^image\/(png|jpe?g|webp)$/.test(contentType)) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength === 0 || buffer.byteLength > 20 * 1024 * 1024) return null
    return { buffer, contentType: contentType === "image/jpg" ? "image/jpeg" : contentType }
  } catch {
    return null
  }
}

async function generateSectionImage(
  ctx: StepContext,
  section: ContentSectionRow,
  promptOverride?: string | null,
): Promise<{ section: ContentSectionRow; image: ContentImageRow }> {
  const prompt = (promptOverride ?? section.image_prompt)?.trim()
  if (!prompt) throw badRequest("이미지 프롬프트가 없습니다.")

  // 실제 상품 사진이 있으면 참조 이미지로 사용 → 생성 컷에 '진짜 그 상품'이 등장 (구매 전환에 가장 큰 영향)
  const content = await getContent(ctx.supabase, ctx.contentId)
  const product = await ensureProductImage(ctx, await getProduct(ctx.supabase, content.product_id))
  const referenceImage = await fetchReferenceImage(product.image_url)
  const generated = await generateImage(ctx, buildFinalImagePrompt(prompt, { withProductReference: Boolean(referenceImage) }), {
    referenceImage,
    fallbackPrompt: buildFinalImagePrompt(prompt),
  })
  const storagePath = `${ctx.userId}/${ctx.contentId}/${section.id}-${Date.now()}.${generated.extension}`
  const bucket = ctx.supabase.storage.from(STORAGE_BUCKETS.contentImages)
  const { error: uploadError } = await bucket.upload(storagePath, generated.buffer, {
    contentType: generated.contentType,
    upsert: false,
  })
  if (uploadError) throw new ApiError(500, `이미지 업로드 실패: ${uploadError.message}`)
  const imageUrl = bucket.getPublicUrl(storagePath).data.publicUrl

  const { data: image, error: imageError } = await ctx.supabase
    .from("content_images")
    .insert({
      user_id: ctx.userId,
      content_id: ctx.contentId,
      section_id: section.id,
      kind: section.image_kind,
      prompt,
      image_url: imageUrl,
      storage_path: storagePath,
      model: generated.model,
    })
    .select("*")
    .single()
  if (imageError) throw new ApiError(500, `이미지 기록 저장 실패: ${imageError.message}`)

  const { data: updated, error: sectionError } = await ctx.supabase
    .from("content_sections")
    .update({ image_url: imageUrl, image_prompt: prompt })
    .eq("id", section.id)
    .select("*")
    .single()
  if (sectionError) throw new ApiError(500, `섹션 이미지 저장 실패: ${sectionError.message}`)

  return { section: updated as ContentSectionRow, image: image as ContentImageRow }
}

/** 파이프라인용: 아직 이미지가 없는 다음 섹션의 이미지를 1장 생성 */
export async function runNextImage(ctx: StepContext): Promise<ImageGenerationResult> {
  const sections = await getSections(ctx.supabase, ctx.contentId)
  const next = sections.find((s) => s.image_prompt && !s.image_url)
  if (!next) {
    await setStepStatus(ctx, "images", "completed")
    return { section: null, image: null, remaining: 0 }
  }

  await setStepStatus(ctx, "images", "processing")
  try {
    const result = await generateSectionImage(ctx, next)
    const remaining = await countRemainingImages(ctx)
    if (remaining === 0) await setStepStatus(ctx, "images", "completed")
    return { ...result, remaining }
  } catch (error) {
    await setStepStatus(ctx, "images", "failed", error instanceof Error ? error.message : String(error))
    throw error
  }
}

/** 에디터용: 특정 섹션 이미지 (재)생성. 프롬프트 수정 가능 */
export async function regenerateSectionImage(
  ctx: StepContext,
  sectionId: string,
  prompt?: string | null,
): Promise<ImageGenerationResult> {
  const sections = await getSections(ctx.supabase, ctx.contentId)
  const section = sections.find((s) => s.id === sectionId)
  if (!section) throw badRequest("섹션을 찾을 수 없습니다.")
  const result = await generateSectionImage(ctx, section, prompt)
  return { ...result, remaining: await countRemainingImages(ctx) }
}

export async function skipImages(ctx: StepContext): Promise<void> {
  await setStepStatus(ctx, "images", "skipped")
}

// ---------------------------------------------------------------------------
// STEP 8. 쇼핑 커넥트 링크 배치 + 경제적 이해관계 표시
// ---------------------------------------------------------------------------
function chooseAffiliateSections(sections: ContentSectionRow[], productName: string, max: number): Set<string> {
  const flagged = sections.filter((s) => s.insert_affiliate_link)
  let chosen: ContentSectionRow[]

  if (flagged.length > max) {
    // 첫 번째(상품 소개)와 마지막(마무리) 우선
    chosen = max === 1 ? [flagged[0]] : [flagged[0], ...flagged.slice(1, max - 1), flagged[flagged.length - 1]]
  } else if (flagged.length > 0) {
    chosen = flagged
  } else {
    // AI 가 위치를 고르지 않았다면: 상품 소개 섹션 + 마지막 섹션
    const nameToken = productName.split(/\s+/)[0] ?? productName
    const intro =
      sections.find((s) => s.heading.includes(nameToken) || s.body.includes(productName)) ??
      sections[Math.floor(sections.length / 2)]
    chosen = [intro]
    const last = sections[sections.length - 1]
    if (max > 1 && last && last.id !== intro?.id) chosen.push(last)
  }
  return new Set(chosen.filter(Boolean).slice(0, max).map((s) => s.id))
}

export async function runAffiliateLinks(ctx: StepContext): Promise<ContentSectionRow[]> {
  return runStep(ctx, "affiliate_links", async () => {
    const content = await getContent(ctx.supabase, ctx.contentId)
    const product = await getProduct(ctx.supabase, content.product_id)
    const sections = await getSections(ctx.supabase, ctx.contentId)
    if (!sections.length) throw badRequest("본문이 먼저 생성되어야 합니다.")

    const hasLink = Boolean(product.affiliate_url?.trim())
    const chosen = hasLink ? chooseAffiliateSections(sections, product.name, content.max_affiliate_links) : new Set<string>()
    const orderedChosen = sections.filter((s) => chosen.has(s.id))
    const lastChosenId = orderedChosen[orderedChosen.length - 1]?.id

    const results = await Promise.all(
      sections.map((section) => {
        const insert = chosen.has(section.id)
        return ctx.supabase
          .from("content_sections")
          .update({
            insert_affiliate_link: insert,
            cta_text: insert
              ? section.cta_text || defaultCtaText(content.cta_strength, section.id === lastChosenId && orderedChosen.length > 1)
              : null,
          })
          .eq("id", section.id)
      }),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) throw new ApiError(500, `링크 배치 저장 실패: ${failed.error.message}`)

    // 경제적 이해관계 표시: 기본으로 항상 삽입 (사용자가 이후 수정/삭제 가능)
    if (!content.disclosure?.trim()) {
      await updateContent(ctx, { disclosure: DEFAULT_DISCLOSURE })
    }
    return getSections(ctx.supabase, ctx.contentId)
  })
}

// ---------------------------------------------------------------------------
// STEP 9. 콘텐츠 검수
// ---------------------------------------------------------------------------
export async function runReview(
  ctx: StepContext,
  options: { mode: "optimize" | "evaluate"; trackStep?: boolean },
): Promise<ContentReviewRow> {
  const execute = async () => {
    const bundle = await loadContentBundle(ctx.supabase, ctx.contentId)
    const { content, product, keywordAnalysis, sections } = bundle
    if (!sections.length) throw badRequest("검수할 본문이 없습니다.")

    const blog = toBlogContent(content, sections)
    const mainKeyword = keywordAnalysis?.main_keyword ?? content.main_keyword_input ?? null
    const lintOptions = { mainKeyword, maxAffiliateLinks: content.max_affiliate_links }
    const lint = lintContent(blog, lintOptions)
    const facts = toProductFacts(product)
    const promptInput = {
      mode: options.mode,
      product: facts,
      mainKeyword: mainKeyword ?? "",
      searchIntent: keywordAnalysis?.search_intent ?? "",
      contentType: content.content_type,
      content: blog,
      maxAffiliateLinks: content.max_affiliate_links,
      lintFindings: lint.findings,
    }

    let score: number
    let metricsJson: ReviewMetricsJson
    let issues = lint.issues

    if (options.mode === "optimize") {
      const review = await generateStructured({
        ctx,
        action: "review",
        schema: reviewResultSchema,
        schemaName: "content_review",
        prompt: createContentReviewPrompt(promptInput),
        mock: () => mockReview(blog),
        validate: (value) => {
          const ids = new Set(blog.sections.map((s) => s.id))
          const missing = value.optimizedContent.sections.filter((s) => !ids.has(s.id))
          return missing.length ? "optimizedContent.sections 의 id 는 입력된 섹션 id 와 같아야 합니다." : null
        },
      })

      // 개선본 적용 (섹션 id 기준 병합, 이미지/광고 문구는 유지)
      const optimized = review.optimizedContent
      const optimizedById = new Map(optimized.sections.map((s) => [s.id, s]))
      await Promise.all(
        sections.map((section) => {
          const next = optimizedById.get(section.id)
          if (!next) return Promise.resolve()
          return ctx.supabase
            .from("content_sections")
            .update({
              heading: next.heading.trim() || section.heading,
              body: next.body.trim() || section.body,
              insert_affiliate_link: section.insert_affiliate_link && next.insertAffiliateLink,
            })
            .eq("id", section.id)
            .then(() => undefined)
        }),
      )
      const updatedContent = await updateContent(ctx, {
        title: optimized.title.trim() || content.title,
        intro: optimized.intro.trim() || content.intro,
        conclusion: optimized.conclusion.trim() || content.conclusion,
        hashtags: optimized.hashtags.length
          ? Array.from(new Set(optimized.hashtags.map(normalizeHashtag).filter(Boolean)))
          : content.hashtags,
      })

      // 적용 후 남은 문제를 규칙 기반으로 다시 확인
      const finalLint = lintContent(toBlogContent(updatedContent, await getSections(ctx.supabase, ctx.contentId)), lintOptions)
      issues = finalLint.issues
      score = review.score
      metricsJson = { ...review.metrics, overall: review.score, mode: "optimize", fixedIssues: review.issues, stats: finalLint.stats }
    } else {
      const review = await generateStructured({
        ctx,
        action: "review",
        schema: reviewEvaluationSchema,
        schemaName: "content_review_evaluation",
        prompt: createContentReviewPrompt(promptInput),
        mock: () => {
          const { optimizedContent: _unused, ...rest } = mockReview(blog)
          void _unused
          return rest
        },
      })
      issues = mergeIssues(review.issues, lint.issues)
      score = review.score
      metricsJson = { ...review.metrics, overall: review.score, mode: "evaluate", stats: lint.stats }
    }

    // 규칙 기반 high 이슈(허위 경험, 광고 표시 누락 등)가 남아 있으면 점수 상한 적용
    const hasHigh = issues.some((i) => i.severity === "high")
    const finalScore = Math.max(0, Math.min(100, hasHigh ? Math.min(score, 69) : score))
    metricsJson.overall = finalScore

    const { data, error } = await ctx.supabase
      .from("content_reviews")
      .insert({ user_id: ctx.userId, content_id: ctx.contentId, score: finalScore, issues, metrics: metricsJson })
      .select("*")
      .single()
    if (error) throw new ApiError(500, `검수 결과 저장 실패: ${error.message}`)
    await updateContent(ctx, { quality_score: finalScore })
    return data as ContentReviewRow
  }

  return options.trackStep === false ? execute() : runStep(ctx, "review", execute)
}

// ---------------------------------------------------------------------------
// STEP 10. 최종 콘텐츠 JSON
// ---------------------------------------------------------------------------
export async function runFinalize(ctx: StepContext): Promise<FinalContent> {
  return runStep(ctx, "finalize", async () => {
    const bundle = await loadContentBundle(ctx.supabase, ctx.contentId)
    if (!bundle.content.title || !bundle.sections.length) throw badRequest("제목과 본문이 있어야 완료할 수 있습니다.")
    if (bundle.content.status !== "published") {
      await updateContent(ctx, { status: "completed" })
    }
    return buildFinalContent(bundle)
  })
}

// ---------------------------------------------------------------------------
// 특정 섹션 재생성
// ---------------------------------------------------------------------------
export async function regenerateSection(
  ctx: StepContext,
  sectionId: string,
  instruction: string | null,
): Promise<ContentSectionRow> {
  const content = await getContent(ctx.supabase, ctx.contentId)
  const product = await getProduct(ctx.supabase, content.product_id)
  const sections = await getSections(ctx.supabase, ctx.contentId)
  const index = sections.findIndex((s) => s.id === sectionId)
  if (index < 0) throw badRequest("섹션을 찾을 수 없습니다.")
  const section = sections[index]
  const keywordRow = content.keyword_analysis_id
    ? ((await ctx.supabase.from("keyword_analyses").select("main_keyword").eq("id", content.keyword_analysis_id).single())
        .data as { main_keyword: string } | null)
    : null

  const result = await generateStructured({
    ctx,
    action: "regenerate_section",
    schema: regeneratedSectionSchema,
    schemaName: "regenerated_section",
    prompt: createSectionRegenerationPrompt({
      product: toProductFacts(product),
      title: content.title ?? "",
      mainKeyword: keywordRow?.main_keyword ?? content.main_keyword_input ?? "",
      contentType: content.content_type,
      brandTone: content.brand_tone,
      outline: sections.map((s) => s.heading),
      section: { heading: section.heading, body: section.body },
      previousHeading: sections[index - 1]?.heading ?? null,
      nextHeading: sections[index + 1]?.heading ?? null,
      instruction,
    }),
    mock: () => mockRegeneratedSection(section, instruction),
  })

  const { data, error } = await ctx.supabase
    .from("content_sections")
    .update({ heading: result.heading.trim(), body: result.body.trim() })
    .eq("id", sectionId)
    .select("*")
    .single()
  if (error) throw new ApiError(500, `섹션 저장 실패: ${error.message}`)
  return data as ContentSectionRow
}
