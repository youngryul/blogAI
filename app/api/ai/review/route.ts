import { createStepRoute } from "@/lib/api/step-route"
import { runReview } from "@/lib/pipeline/steps"
import { reviewRequestSchema } from "@/lib/validation"

export const maxDuration = 300

/**
 * STEP 9. 콘텐츠 검수
 * - mode=optimize: 검수 + 개선본 자동 적용 (파이프라인 기본)
 * - mode=evaluate: 현재 글 평가만 (에디터 재검수)
 */
export const POST = createStepRoute(reviewRequestSchema, (ctx, body) =>
  runReview(ctx, { mode: body.mode, trackStep: body.trackStep ?? body.mode === "optimize" }),
)
