import { requireAuth } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/errors"
import { handle, ok, parseBody } from "@/lib/api/http"
import { getProduct, listContents } from "@/lib/data/contents"
import { contentCreateSchema } from "@/lib/validation"
import { CONTENT_STATUSES, PIPELINE_STEPS, type ContentRow, type ContentStatus } from "@/types"

/** 콘텐츠 목록 (?status=draft&limit=20&offset=0) */
export const GET = handle(async (request: Request) => {
  const { supabase } = await requireAuth(request)
  const params = new URL(request.url).searchParams
  const statusParam = params.get("status")
  const status = CONTENT_STATUSES.includes(statusParam as ContentStatus) ? (statusParam as ContentStatus) : undefined
  const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 20))
  const offset = Math.max(0, Number(params.get("offset")) || 0)
  return ok(await listContents(supabase, { status, limit, offset }))
})

/** 콘텐츠 초안 생성 (상품 + 생성 옵션) → 파이프라인 단계 초기화 */
export const POST = handle(async (request: Request) => {
  const { supabase, user } = await requireAuth(request)
  const input = await parseBody(request, contentCreateSchema)
  const product = await getProduct(supabase, input.productId)

  const { data, error } = await supabase
    .from("contents")
    .insert({
      user_id: user.id,
      product_id: product.id,
      content_type: input.contentType,
      main_keyword_input: input.mainKeyword,
      target_reader: input.targetReader ?? product.target_reader,
      brand_tone: input.brandTone,
      length_option: input.lengthOption,
      cta_strength: input.ctaStrength,
      disclosure_position: input.disclosurePosition,
      max_affiliate_links: input.maxAffiliateLinks,
      status: "draft",
    })
    .select("*")
    .single()
  if (error) throw new ApiError(500, `콘텐츠 생성 실패: ${error.message}`)

  const { error: stepsError } = await supabase
    .from("generation_steps")
    .insert(PIPELINE_STEPS.map((step) => ({ user_id: user.id, content_id: data.id, step, status: "pending" })))
  if (stepsError) console.warn("[contents] failed to init steps:", stepsError.message)

  return ok(data as ContentRow, { status: 201 })
})
