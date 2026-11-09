import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import { unauthorized } from "@/lib/api/errors"
import { fail, handle, ok, parseBody } from "@/lib/api/http"
import { getSupabaseEnv } from "@/lib/env"

/**
 * 크롬 확장 프로그램 → 브랜드 커넥트 상품 목록·발급 링크 저장.
 * 인증은 /api/extension/metrics 와 같은 연결 코드. 저장은 DB 함수 ingest_connect_products 가 처리한다.
 */
const text = (max: number) => z.string().trim().max(max).nullish()
const httpsUrl = z
  .string()
  .trim()
  .max(1000)
  .regex(/^https?:\/\//)
  .nullish()
  .catch(null)

const bodySchema = z.object({
  products: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(200),
        name: z.string().trim().min(1).max(300),
        price: z.number().finite().nonnegative().nullish().catch(null),
        commissionRate: z.number().finite().min(0).max(100).nullish().catch(null),
        imageUrl: httpsUrl,
        productUrl: httpsUrl,
        storeName: text(200).catch(null),
        category: text(300).catch(null),
        source: z.enum(["popular", "recommended", "search"]).catch("search"),
        rank: z.number().int().min(1).max(10000).nullish().catch(null),
        affiliateUrl: z.string().trim().max(500).regex(/^https:\/\//).nullish().catch(null),
        pageUrl: httpsUrl,
      }),
    )
    .max(1000)
    .default([]),
  links: z
    .array(z.object({ key: z.string().trim().min(1).max(200), affiliateUrl: z.string().trim().max(500).regex(/^https:\/\//) }))
    .max(200)
    .default([]),
})

export const POST = handle(async (request: Request) => {
  const auth = request.headers.get("authorization") ?? ""
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : ""
  if (!/^cn_[a-f0-9]{48}$/.test(token)) throw unauthorized()

  const { products, links } = await parseBody(request, bodySchema)
  const { url, anonKey } = getSupabaseEnv()
  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data, error } = await supabase.rpc("ingest_connect_products", {
    p_token: token,
    p_products: products,
    p_links: links,
  })
  if (error) {
    if (error.message.includes("invalid extension token")) return fail(401, "연결 코드가 올바르지 않습니다. 설정에서 새로 발급하세요.")
    if (error.message.includes("ingest_connect_products"))
      return fail(500, "connect_products 마이그레이션(20261109000400)을 먼저 실행하세요.")
    return fail(500, `저장 실패: ${error.message}`)
  }
  const result = (data ?? {}) as { products?: number; links?: number }
  return ok({ products: Number(result.products ?? 0), links: Number(result.links ?? 0) })
})
