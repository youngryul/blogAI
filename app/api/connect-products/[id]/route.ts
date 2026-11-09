import { requireAuth } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/errors"
import { handle, ok } from "@/lib/api/http"
import type { ConnectProductRow } from "@/types"

type Ctx = RouteContext<"/api/connect-products/[id]">

/** 브랜드 커넥트 상품 1건 — 새 콘텐츠 화면이 링크 발급 여부를 확인할 때 사용 */
export const GET = handle(async (request: Request, context: Ctx) => {
  const { id } = await context.params
  const { supabase } = await requireAuth(request)
  const { data, error } = await supabase.from("connect_products").select("*").eq("id", id).maybeSingle()
  if (error) throw new ApiError(500, error.message)
  if (!data) throw new ApiError(404, "상품을 찾을 수 없습니다.")
  return ok(data as ConnectProductRow)
})
