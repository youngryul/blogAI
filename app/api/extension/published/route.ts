import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import { unauthorized } from "@/lib/api/errors"
import { fail, handle, ok, parseBody } from "@/lib/api/http"
import { getSupabaseEnv } from "@/lib/env"

/**
 * 크롬 확장 프로그램 → 발행 완료 기록.
 * 블로그 자동 작성 후 사용자가 직접 발행하면, 확장 프로그램이 글 보기 주소를 읽어 보낸다.
 * 검증과 저장은 DB 함수 record_published_post 가 연결 코드로 사용자를 찾아 처리한다.
 */
const bodySchema = z.object({
  contentId: z.uuid(),
  blogUrl: z
    .string()
    .trim()
    .regex(/^https:\/\/(m\.)?blog\.naver\.com\/[A-Za-z0-9_-]{3,40}\/\d{6,}$/),
})

export const POST = handle(async (request: Request) => {
  const auth = request.headers.get("authorization") ?? ""
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : ""
  if (!/^cn_[a-f0-9]{48}$/.test(token)) throw unauthorized()

  const { contentId, blogUrl } = await parseBody(request, bodySchema)
  const { url, anonKey } = getSupabaseEnv()
  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data, error } = await supabase.rpc("record_published_post", {
    p_token: token,
    p_content_id: contentId,
    p_blog_url: blogUrl,
  })
  if (error) {
    if (error.message.includes("invalid extension token")) return fail(401, "연결 코드가 올바르지 않습니다. 설정에서 새로 발급하세요.")
    if (error.message.includes("content not found")) return fail(404, "콘텐츠를 찾을 수 없습니다.")
    if (error.message.includes("record_published_post"))
      return fail(500, "record_published_post 마이그레이션(20261109000500)을 먼저 실행하세요.")
    return fail(500, `발행 기록 실패: ${error.message}`)
  }
  return ok({ id: data as string })
})
