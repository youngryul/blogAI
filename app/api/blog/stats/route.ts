import { requireAuth } from "@/lib/api/auth"
import { handle, ok } from "@/lib/api/http"
import { getBlogStats, getLinkedBlogId } from "@/lib/naver/blog"

/** 연결된 네이버 블로그 정보 + 확장 프로그램이 수집한 방문자·수익 지표 */
export const GET = handle(async (request: Request) => {
  const { supabase, user } = await requireAuth(request)
  const blogId = await getLinkedBlogId(supabase, user.id)
  if (!blogId) return ok({ connected: false as const })
  return ok({ connected: true as const, blogId, ...(await getBlogStats(supabase, blogId)) })
})
