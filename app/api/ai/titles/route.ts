import { createStepRoute } from "@/lib/api/step-route"
import { runTitles } from "@/lib/pipeline/steps"
import { contentIdSchema } from "@/lib/validation"

export const maxDuration = 300

/** 제목 후보 5개 생성 */
export const POST = createStepRoute(contentIdSchema, (ctx) => runTitles(ctx))
