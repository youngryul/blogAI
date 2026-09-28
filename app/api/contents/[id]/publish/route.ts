import { requireAuth } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/errors"
import { handle, ok, parseBody } from "@/lib/api/http"
import { getContent } from "@/lib/data/contents"
import { publishSchema } from "@/lib/validation"
import type { PublishedPostRow } from "@/types"

/**
 * 발행 완료 기록. 실제 게시는 사용자가 네이버 블로그에서 직접 한다.
 * (자동 로그인/자동 발행 기능은 제공하지 않는다.)
 */
export const POST = handle(async (request: Request, context: RouteContext<"/api/contents/[id]/publish">) => {
  const { id } = await context.params
  const { supabase, user } = await requireAuth(request)
  await getContent(supabase, id)
  const input = await parseBody(request, publishSchema)

  const { data, error } = await supabase
    .from("published_posts")
    .insert({ user_id: user.id, content_id: id, blog_url: input.blogUrl })
    .select("*")
    .single()
  if (error) throw new ApiError(500, `발행 기록 실패: ${error.message}`)

  await supabase.from("contents").update({ status: "published" }).eq("id", id)
  return ok(data as PublishedPostRow, { status: 201 })
})
