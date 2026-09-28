import "server-only"

import type { z } from "zod"
import { requireAuth } from "@/lib/api/auth"
import { handle, ok, parseBody } from "@/lib/api/http"
import { getContent } from "@/lib/data/contents"
import type { StepContext } from "@/lib/pipeline/steps"

/**
 * AI 단계 Route Handler 팩토리.
 * 인증 → 바디 검증 → 콘텐츠 소유권 확인(RLS) → 단계 실행 → { data } 응답
 */
export function createStepRoute<S extends z.ZodType<{ contentId: string }>, R>(
  schema: S,
  run: (ctx: StepContext, body: z.infer<S>) => Promise<R>,
) {
  return handle(async (request: Request) => {
    const { supabase, user } = await requireAuth(request)
    const body = await parseBody(request, schema)
    // RLS 로 본인 콘텐츠만 조회된다. 없으면 404.
    await getContent(supabase, body.contentId)
    const ctx: StepContext = { supabase, userId: user.id, contentId: body.contentId }
    return ok(await run(ctx, body))
  })
}
