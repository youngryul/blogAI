import { createStepRoute } from "@/lib/api/step-route"
import { runBlog } from "@/lib/pipeline/steps"
import { blogRequestSchema } from "@/lib/validation"

export const maxDuration = 300

/** STEP 5. 블로그 본문 생성 (title 을 함께 보내면 제목 확정 후 생성) */
export const POST = createStepRoute(blogRequestSchema, (ctx, body) => runBlog(ctx, { title: body.title }))
