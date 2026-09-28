import { requireAuth } from "@/lib/api/auth"
import { handle, ok } from "@/lib/api/http"
import { buildFinalContent, toHtmlAll, toHtmlBody, toPlainTextAll, toPlainTextBody } from "@/lib/content/format"
import { loadContentBundle } from "@/lib/data/contents"

/**
 * 최종 콘텐츠 내보내기 (STEP 10 결과).
 * 웹 미리보기와 추후 Chrome Extension(Bearer 토큰 인증)이 공통으로 사용하는 읽기 전용 API.
 */
export const GET = handle(async (request: Request, context: RouteContext<"/api/contents/[id]/export">) => {
  const { id } = await context.params
  const { supabase } = await requireAuth(request)
  const final = buildFinalContent(await loadContentBundle(supabase, id))
  return ok({
    content: final,
    plainText: { all: toPlainTextAll(final), body: toPlainTextBody(final) },
    html: { all: toHtmlAll(final), body: toHtmlBody(final) },
  })
})
