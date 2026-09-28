import { requireAuth } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/errors"
import { handle, ok, parseBody } from "@/lib/api/http"
import { getProduct } from "@/lib/data/contents"
import { productInputSchema } from "@/lib/validation"
import type { ProductRow } from "@/types"

type Ctx = RouteContext<"/api/products/[id]">

export const GET = handle(async (request: Request, context: Ctx) => {
  const { id } = await context.params
  const { supabase } = await requireAuth(request)
  return ok(await getProduct(supabase, id))
})

export const PUT = handle(async (request: Request, context: Ctx) => {
  const { id } = await context.params
  const { supabase } = await requireAuth(request)
  await getProduct(supabase, id)
  const input = await parseBody(request, productInputSchema)
  const { data, error } = await supabase
    .from("products")
    .update({
      name: input.name,
      category: input.category,
      price: input.price,
      product_url: input.productUrl,
      affiliate_url: input.affiliateUrl,
      description: input.description,
      features: input.features,
      target_reader: input.targetReader,
      image_url: input.imageUrl,
    })
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw new ApiError(500, `상품 수정 실패: ${error.message}`)
  return ok(data as ProductRow)
})

/** 상품 삭제 (연결된 콘텐츠도 함께 삭제됨) */
export const DELETE = handle(async (request: Request, context: Ctx) => {
  const { id } = await context.params
  const { supabase } = await requireAuth(request)
  await getProduct(supabase, id)
  const { error } = await supabase.from("products").delete().eq("id", id)
  if (error) throw new ApiError(500, `상품 삭제 실패: ${error.message}`)
  return ok({ id })
})
