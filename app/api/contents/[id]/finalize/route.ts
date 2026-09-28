import { requireAuth } from "@/lib/api/auth"
import { handle, ok } from "@/lib/api/http"
import { runFinalize } from "@/lib/pipeline/steps"

/** STEP 10. 최종 콘텐츠 JSON 생성 + 상태 completed */
export const POST = handle(async (request: Request, context: RouteContext<"/api/contents/[id]/finalize">) => {
  const { id } = await context.params
  const { supabase, user } = await requireAuth(request)
  return ok(await runFinalize({ supabase, userId: user.id, contentId: id }))
})
