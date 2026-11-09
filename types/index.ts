/**
 * 도메인 타입 정의.
 * AI 결과 타입은 Zod 스키마(lib/ai/schemas)에서 추론한 타입을 재노출한다.
 */
export type {
  ProductAnalysis,
  KeywordAnalysis,
  SearchIntentType,
  ContentStrategy,
  TitleCandidate,
  BlogContent,
  BlogSection,
  BlogDraft,
  ImageKind,
  ImagePromptPlan,
  ReviewIssue,
  ReviewIssueType,
  ReviewSeverity,
  ReviewResult,
  ReviewEvaluation,
  QualityMetrics,
  RegeneratedSection,
} from "@/lib/ai/schemas"

import type {
  ImageKind,
  QualityMetrics,
  ReviewIssue,
  SearchIntentType,
  TitleCandidate,
  ProductAnalysis,
} from "@/lib/ai/schemas"

// ---------------------------------------------------------------------------
// Enum-like unions
// ---------------------------------------------------------------------------
export const CONTENT_STATUSES = ["draft", "generating", "completed", "published"] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

export const CONTENT_TYPES = [
  "informational",
  "recommendation",
  "comparison",
  "buying_guide",
  "review",
] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

export const LENGTH_OPTIONS = ["short", "normal", "long"] as const
export type LengthOption = (typeof LENGTH_OPTIONS)[number]

export const CTA_STRENGTHS = ["weak", "normal", "strong"] as const
export type CtaStrength = (typeof CTA_STRENGTHS)[number]

export const DISCLOSURE_POSITIONS = ["top", "bottom"] as const
export type DisclosurePosition = (typeof DISCLOSURE_POSITIONS)[number]

export const STEP_STATUSES = ["pending", "processing", "completed", "failed", "skipped"] as const
export type StepStatus = (typeof STEP_STATUSES)[number]

/** 콘텐츠 생성 파이프라인 단계 (순서가 곧 실행 순서) */
export const PIPELINE_STEPS = [
  "product_analysis",
  "keyword_analysis",
  "content_strategy",
  "titles",
  "blog",
  "image_prompts",
  "images",
  "affiliate_links",
  "review",
  "finalize",
] as const
export type PipelineStep = (typeof PIPELINE_STEPS)[number]

export type AIAction =
  | "product_analysis"
  | "keyword_analysis"
  | "content_strategy"
  | "titles"
  | "blog"
  | "image_prompts"
  | "image_generation"
  | "affiliate_links"
  | "review"
  | "regenerate_section"

// ---------------------------------------------------------------------------
// Database rows
// ---------------------------------------------------------------------------
export interface ProfileRow {
  id: string
  email: string | null
  display_name: string | null
  created_at: string
  updated_at: string
}

export interface ProductRow {
  id: string
  user_id: string
  name: string
  category: string | null
  price: number | null
  product_url: string | null
  affiliate_url: string | null
  description: string | null
  features: string[]
  target_reader: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

export interface ProductAnalysisRow {
  id: string
  user_id: string
  product_id: string
  result: ProductAnalysis
  created_at: string
}

export interface KeywordAnalysisRow {
  id: string
  user_id: string
  product_id: string
  main_keyword: string
  secondary_keywords: string[]
  longtail_keywords: string[]
  search_intent: string | null
  search_intent_type: SearchIntentType | null
  target_reader: string | null
  user_questions: string[]
  article_angles: string[]
  provider: string
  metrics: Record<string, unknown> | null
  created_at: string
}

export interface ContentStrategyRow {
  id: string
  user_id: string
  product_id: string
  keyword_analysis_id: string | null
  primary_angle: string | null
  target_reader: string | null
  reader_problem: string | null
  article_goal: string | null
  recommended_length: number | null
  recommended_image_count: number | null
  section_plan: { heading: string; purpose: string }[]
  created_at: string
}

export interface ContentRow {
  id: string
  user_id: string
  product_id: string
  product_analysis_id: string | null
  keyword_analysis_id: string | null
  strategy_id: string | null
  content_type: ContentType
  main_keyword_input: string | null
  target_reader: string | null
  brand_tone: string | null
  length_option: LengthOption
  cta_strength: CtaStrength
  max_affiliate_links: number
  title_candidates: TitleCandidate[]
  title: string | null
  intro: string | null
  conclusion: string | null
  disclosure: string | null
  disclosure_position: DisclosurePosition
  hashtags: string[]
  status: ContentStatus
  quality_score: number | null
  created_at: string
  updated_at: string
}

export interface ContentSectionRow {
  id: string
  user_id: string
  content_id: string
  sort_order: number
  heading: string
  body: string
  image_kind: ImageKind | null
  image_prompt: string | null
  image_url: string | null
  insert_affiliate_link: boolean
  cta_text: string | null
  created_at: string
  updated_at: string
}

export interface ContentImageRow {
  id: string
  user_id: string
  content_id: string
  section_id: string | null
  kind: string | null
  prompt: string
  image_url: string
  storage_path: string | null
  model: string | null
  created_at: string
}

export interface ContentReviewRow {
  id: string
  user_id: string
  content_id: string
  score: number
  issues: ReviewIssue[]
  metrics: ReviewMetricsJson
  created_at: string
}

/** content_reviews.metrics 컬럼 구조 */
export type ReviewMetricsJson = Partial<QualityMetrics> & {
  overall?: number
  mode?: "optimize" | "evaluate"
  /** optimize 모드에서 개선본에 반영(자동 수정)된 항목 */
  fixedIssues?: ReviewIssue[]
  stats?: {
    totalChars: number
    paragraphCount: number
    longParagraphCount: number
    keywordCount: number
    affiliateLinkCount: number
    hasDisclosure: boolean
  }
}

export interface PublishedPostRow {
  id: string
  user_id: string
  content_id: string
  blog_url: string | null
  published_at: string
  created_at: string
}

export interface GenerationStepRow {
  id: string
  user_id: string
  content_id: string
  step: PipelineStep
  status: StepStatus
  error: string | null
  started_at: string | null
  completed_at: string | null
  updated_at: string
}

export interface AIUsageRow {
  id: string
  user_id: string
  content_id: string | null
  action: AIAction
  model: string
  input_tokens: number
  output_tokens: number
  image_count: number
  estimated_cost: number
  created_at: string
}

// ---------------------------------------------------------------------------
// Aggregates (API 응답)
// ---------------------------------------------------------------------------
export interface ContentBundle {
  content: ContentRow
  product: ProductRow
  productAnalysis: ProductAnalysisRow | null
  keywordAnalysis: KeywordAnalysisRow | null
  strategy: ContentStrategyRow | null
  sections: ContentSectionRow[]
  images: ContentImageRow[]
  review: ContentReviewRow | null
  steps: GenerationStepRow[]
  publishedPosts: PublishedPostRow[]
}

export interface ContentListItem {
  id: string
  title: string | null
  status: ContentStatus
  quality_score: number | null
  created_at: string
  updated_at: string
  product: { id: string; name: string } | null
  keyword: { main_keyword: string } | null
}

// ---------------------------------------------------------------------------
// 브랜드 커넥트(쇼핑 커넥트) 상품 — 크롬 확장 프로그램이 수집
// ---------------------------------------------------------------------------
export const CONNECT_PRODUCT_SOURCES = ["popular", "recommended", "search"] as const
export type ConnectProductSource = (typeof CONNECT_PRODUCT_SOURCES)[number]

export interface ConnectProductRow {
  id: string
  user_id: string
  product_key: string
  name: string
  price: number | null
  commission_rate: number | null
  image_url: string | null
  product_url: string | null
  store_name: string | null
  category: string | null
  source: ConnectProductSource
  rank: number | null
  affiliate_url: string | null
  link_issued_at: string | null
  page_url: string | null
  seen_at: string
  created_at: string
}
