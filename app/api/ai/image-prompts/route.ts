import { createStepRoute } from "@/lib/api/step-route"
import { runImagePrompts } from "@/lib/pipeline/steps"
import { contentIdSchema } from "@/lib/validation"

export const maxDuration = 300

/** STEP 6. 이미지 프롬프트 생성 */
export const POST = createStepRoute(contentIdSchema, (ctx) => runImagePrompts(ctx))
