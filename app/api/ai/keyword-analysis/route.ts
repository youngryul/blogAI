import { createStepRoute } from "@/lib/api/step-route"
import { runKeywordAnalysis } from "@/lib/pipeline/steps"
import { contentIdSchema } from "@/lib/validation"

export const maxDuration = 300

/** STEP 2~3. 키워드 + 검색 의도 분석 */
export const POST = createStepRoute(contentIdSchema, (ctx) => runKeywordAnalysis(ctx))
