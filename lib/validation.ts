/** API 요청 바디 검증 스키마 (클라이언트 폼과 공용) */
import { z } from "zod"
import { CONTENT_STATUSES, CONTENT_TYPES, CTA_STRENGTHS, DISCLOSURE_POSITIONS, LENGTH_OPTIONS } from "@/types"

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), { message: "http(s):// 로 시작하는 URL 을 입력하세요." })

export const productInputSchema = z.object({
  name: z.string().trim().min(1, "상품명을 입력하세요.").max(200),
  category: optionalText(100),
  price: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null
      const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.]/g, ""))
      return Number.isFinite(n) ? Math.round(n) : null
    }),
  productUrl: optionalUrl,
  affiliateUrl: optionalUrl,
  description: optionalText(5000),
  features: z
    .array(z.string().trim().max(300))
    .max(30)
    .optional()
    .default([])
    .transform((items) => items.filter(Boolean)),
  targetReader: optionalText(300),
  imageUrl: optionalUrl,
})
export type ProductInput = z.input<typeof productInputSchema>

export const contentCreateSchema = z.object({
  productId: z.uuid(),
  contentType: z.enum(CONTENT_TYPES).default("informational"),
  mainKeyword: optionalText(100),
  targetReader: optionalText(300),
  brandTone: optionalText(100),
  lengthOption: z.enum(LENGTH_OPTIONS).default("normal"),
  ctaStrength: z.enum(CTA_STRENGTHS).default("normal"),
  disclosurePosition: z.enum(DISCLOSURE_POSITIONS).default("top"),
  maxAffiliateLinks: z.number().int().min(1).max(5).default(2),
})
export type ContentCreateInput = z.input<typeof contentCreateSchema>

export const contentIdSchema = z.object({ contentId: z.uuid() })

export const blogRequestSchema = contentIdSchema.extend({
  title: z.string().trim().max(200).optional().nullable(),
})

export const imageRequestSchema = contentIdSchema.extend({
  sectionId: z.uuid().optional().nullable(),
  prompt: z.string().trim().max(4000).optional().nullable(),
  skip: z.boolean().optional(),
})

export const reviewRequestSchema = contentIdSchema.extend({
  mode: z.enum(["optimize", "evaluate"]).default("evaluate"),
  trackStep: z.boolean().optional(),
})

export const regenerateSectionSchema = contentIdSchema.extend({
  sectionId: z.uuid(),
  instruction: z.string().trim().max(1000).optional().nullable(),
})

export const sectionUpdateSchema = z.object({
  id: z.uuid().optional().nullable(),
  heading: z.string().max(300),
  body: z.string().max(20000),
  imagePrompt: z.string().max(4000).nullable().optional(),
  imageUrl: z.string().max(2000).nullable().optional(),
  imageKind: z.enum(["hero", "explain", "usage", "summary"]).nullable().optional(),
  insertAffiliateLink: z.boolean(),
  ctaText: z.string().max(500).nullable().optional(),
})
export type SectionUpdateInput = z.infer<typeof sectionUpdateSchema>

export const contentUpdateSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  intro: z.string().max(10000).nullable().optional(),
  conclusion: z.string().max(10000).nullable().optional(),
  disclosure: z.string().max(1000).nullable().optional(),
  disclosurePosition: z.enum(DISCLOSURE_POSITIONS).optional(),
  hashtags: z.array(z.string().max(50)).max(30).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  ctaStrength: z.enum(CTA_STRENGTHS).optional(),
  /** 전달되면 섹션 전체를 이 목록으로 교체(순서 = sort_order). 없는 id 는 삭제된다. */
  sections: z.array(sectionUpdateSchema).max(30).optional(),
})
export type ContentUpdateInput = z.infer<typeof contentUpdateSchema>

export const publishSchema = z.object({
  blogUrl: optionalUrl,
})
