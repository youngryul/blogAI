import { createStepRoute } from "@/lib/api/step-route"
import { runProductAnalysis } from "@/lib/pipeline/steps"
import { contentIdSchema } from "@/lib/validation"

export const maxDuration = 300

/** STEP 1. 상품 분석 */
export const POST = createStepRoute(contentIdSchema, (ctx) => runProductAnalysis(ctx))
