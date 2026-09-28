import { requireAuth } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/errors"
import { handle, ok, parseBody } from "@/lib/api/http"
import { productInputSchema } from "@/lib/validation"
import type { ProductRow } from "@/types"

/** 상품 목록 */
export const GET = handle(async (request: Request) => {
  const { supabase } = await requireAuth(request)
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false })
  if (error) throw new ApiError(500, error.message)
  return ok((data ?? []) as ProductRow[])
})

/** 상품 생성 */
export const POST = handle(async (request: Request) => {
  const { supabase, user } = await requireAuth(request)
  const input = await parseBody(request, productInputSchema)
  const { data, error } = await supabase
    .from("products")
    .insert({
      user_id: user.id,
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
    .select("*")
    .single()
  if (error) throw new ApiError(500, `상품 저장 실패: ${error.message}`)
  return ok(data as ProductRow, { status: 201 })
})
