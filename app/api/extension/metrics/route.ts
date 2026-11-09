import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import { unauthorized } from "@/lib/api/errors"
import { fail, handle, ok, parseBody } from "@/lib/api/http"
import { getSupabaseEnv } from "@/lib/env"

/**
 * 크롬 확장 프로그램 → 블로그 지표 저장.
 * 인증: `Authorization: Bearer <연결 코드>` (설정 화면에서 발급).
 * 실제 검증과 저장은 DB 함수 ingest_blog_metrics 가 연결 코드 해시로 사용자를 찾아 처리한다.
 * metrics 를 빈 배열로 보내면 연결 확인용으로 쓸 수 있다.
 */
const bodySchema = z.object({
  metrics: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        kind: z.enum(["visitors", "adpost", "connect"]),
        value: z.number().finite().nonnegative(),
      }),
    )
    .max(2000),
})

export const POST = handle(async (request: Request) => {
  const auth = request.headers.get("authorization") ?? ""
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : ""
  if (!/^cn_[a-f0-9]{48}$/.test(token)) throw unauthorized()

  const { metrics } = await parseBody(request, bodySchema)
  const { url, anonKey } = getSupabaseEnv()
  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data, error } = await supabase.rpc("ingest_blog_metrics", { p_token: token, p_metrics: metrics })
  if (error) {
    if (error.message.includes("invalid extension token")) return fail(401, "연결 코드가 올바르지 않습니다. 설정에서 새로 발급하세요.")
    return fail(500, `저장 실패: ${error.message}`)
  }
  return ok({ saved: Number(data ?? 0) })
})
