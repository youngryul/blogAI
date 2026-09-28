import { createStepRoute } from "@/lib/api/step-route"
import { runContentStrategy } from "@/lib/pipeline/steps"
import { contentIdSchema } from "@/lib/validation"

export const maxDuration = 300

/** STEP 4. 콘텐츠 전략 / 구조 */
export const POST = createStepRoute(contentIdSchema, (ctx) => runContentStrategy(ctx))
