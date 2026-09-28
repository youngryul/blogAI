/**
 * AI Structured Output 스키마.
 *
 * OpenAI Structured Outputs(strict mode) 제약에 맞추기 위해
 * - 모든 필드는 required 로 두고, 선택 값은 `.nullable()` 로 표현한다.
 * - 길이/개수 제약은 스키마가 아니라 후처리 검증(validate 함수)에서 확인한다.
 */
import { z } from "zod"

// STEP 1. 상품 분석 ---------------------------------------------------------
export const productAnalysisSchema = z.object({
  productName: z.string(),
  category: z.string(),
  targetUsers: z.array(z.string()),
  mainBenefits: z.array(z.string()),
  purchaseMotivations: z.array(z.string()),
  concerns: z.array(z.string()),
  useCases: z.array(z.string()),
  differentiators: z.array(z.string()),
})
export type ProductAnalysis = z.infer<typeof productAnalysisSchema>

// STEP 2~3. 키워드 + 검색 의도 분석 ---------------------------------------------
export const searchIntentTypeSchema = z.enum(["informational", "commercial", "transactional"])
export type SearchIntentType = z.infer<typeof searchIntentTypeSchema>

export const keywordAnalysisSchema = z.object({
  mainKeyword: z.string(),
  secondaryKeywords: z.array(z.string()),
  longtailKeywords: z.array(z.string()),
  searchIntent: z.string(),
  searchIntentType: searchIntentTypeSchema,
  targetReader: z.string(),
  userQuestions: z.array(z.string()),
  articleAngles: z.array(z.string()),
})
export type KeywordAnalysis = z.infer<typeof keywordAnalysisSchema>

// STEP 4. 콘텐츠 전략 ---------------------------------------------------------
export const contentStrategySchema = z.object({
  primaryAngle: z.string(),
  targetReader: z.string(),
  readerProblem: z.string(),
  articleGoal: z.string(),
  recommendedLength: z.number().int(),
  recommendedImageCount: z.number().int(),
  sectionPlan: z.array(
    z.object({
      heading: z.string(),
      purpose: z.string(),
    }),
  ),
})
export type ContentStrategy = z.infer<typeof contentStrategySchema>

// 제목 후보 -------------------------------------------------------------------
export const titleCandidateSchema = z.object({
  title: z.string(),
  angle: z.string(),
  keywordUsage: z.array(z.string()),
})
export type TitleCandidate = z.infer<typeof titleCandidateSchema>

export const titleCandidatesSchema = z.object({
  titles: z.array(titleCandidateSchema),
})

// STEP 5. 블로그 본문 ----------------------------------------------------------
export const blogSectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  body: z.string(),
  imagePrompt: z.string().nullable(),
  imageUrl: z.string().nullable(),
  insertAffiliateLink: z.boolean(),
})
export type BlogSection = z.infer<typeof blogSectionSchema>

export const blogContentSchema = z.object({
  title: z.string(),
  intro: z.string(),
  sections: z.array(blogSectionSchema),
  conclusion: z.string(),
  disclosure: z.string(),
  hashtags: z.array(z.string()),
})
export type BlogContent = z.infer<typeof blogContentSchema>

/** 본문 생성 단계에서 AI 가 채우는 부분 (이미지/링크 URL 은 이후 단계에서 채움) */
export const blogDraftSchema = z.object({
  intro: z.string(),
  sections: z.array(
    z.object({
      heading: z.string(),
      body: z.string(),
      insertAffiliateLink: z.boolean(),
    }),
  ),
  conclusion: z.string(),
  hashtags: z.array(z.string()),
})
export type BlogDraft = z.infer<typeof blogDraftSchema>

// STEP 6. 이미지 프롬프트 -------------------------------------------------------
export const imageKindSchema = z.enum(["hero", "explain", "usage", "summary"])
export type ImageKind = z.infer<typeof imageKindSchema>

export const imagePromptPlanSchema = z.object({
  images: z.array(
    z.object({
      sectionIndex: z.number().int(),
      kind: imageKindSchema,
      prompt: z.string(),
      altText: z.string(),
    }),
  ),
})
export type ImagePromptPlan = z.infer<typeof imagePromptPlanSchema>

// STEP 9. 검수 --------------------------------------------------------------
export const reviewSeveritySchema = z.enum(["low", "medium", "high"])
export type ReviewSeverity = z.infer<typeof reviewSeveritySchema>

export const reviewIssueTypeSchema = z.enum([
  "false_information",
  "invented_feature",
  "fake_experience",
  "keyword_stuffing",
  "unnatural_ai_tone",
  "repetitive_structure",
  "excessive_advertising",
  "link_repetition",
  "excessive_cta",
  "title_intent_mismatch",
  "long_paragraph",
  "missing_disclosure",
  "medical_claim",
  "other",
])
export type ReviewIssueType = z.infer<typeof reviewIssueTypeSchema>

export const reviewIssueSchema = z.object({
  type: reviewIssueTypeSchema,
  message: z.string(),
  severity: reviewSeveritySchema,
})
export type ReviewIssue = z.infer<typeof reviewIssueSchema>

export const qualityMetricsSchema = z.object({
  searchIntentFit: z.number().int(),
  keywordNaturalness: z.number().int(),
  titleFit: z.number().int(),
  readability: z.number().int(),
  productAccuracy: z.number().int(),
  /** 높을수록 광고성이 적절(과하지 않음) */
  adTone: z.number().int(),
  ctaAppropriateness: z.number().int(),
})
export type QualityMetrics = z.infer<typeof qualityMetricsSchema>

export const reviewResultSchema = z.object({
  score: z.number().int(),
  metrics: qualityMetricsSchema,
  issues: z.array(reviewIssueSchema),
  optimizedContent: blogContentSchema,
})
export type ReviewResult = z.infer<typeof reviewResultSchema>

/** 평가 전용 검수 (개선본 없이 점수/이슈만 — 토큰 절약) */
export const reviewEvaluationSchema = reviewResultSchema.omit({ optimizedContent: true })
export type ReviewEvaluation = z.infer<typeof reviewEvaluationSchema>

// 특정 섹션 재생성 --------------------------------------------------------------
export const regeneratedSectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
})
export type RegeneratedSection = z.infer<typeof regeneratedSectionSchema>
