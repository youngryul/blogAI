import { createStepRoute } from "@/lib/api/step-route"
import { regenerateSection } from "@/lib/pipeline/steps"
import { regenerateSectionSchema } from "@/lib/validation"

export const maxDuration = 300

/** 특정 섹션만 AI 재생성 */
export const POST = createStepRoute(regenerateSectionSchema, (ctx, body) =>
  regenerateSection(ctx, body.sectionId, body.instruction ?? null),
)
