import { createStepRoute } from "@/lib/api/step-route"
import { runAffiliateLinks } from "@/lib/pipeline/steps"
import { contentIdSchema } from "@/lib/validation"

/** STEP 8. 쇼핑 커넥트 링크 배치 + 경제적 이해관계 문구 삽입 */
export const POST = createStepRoute(contentIdSchema, (ctx) => runAffiliateLinks(ctx))
