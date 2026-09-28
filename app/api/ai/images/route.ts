import { createStepRoute } from "@/lib/api/step-route"
import { regenerateSectionImage, runNextImage, skipImages } from "@/lib/pipeline/steps"
import { imageRequestSchema } from "@/lib/validation"

export const maxDuration = 300

/**
 * STEP 7. 이미지 생성 — 요청당 1장.
 * - sectionId 없음: 아직 이미지가 없는 다음 섹션을 생성 (파이프라인). 응답의 remaining 이 0 이 될 때까지 반복 호출.
 * - sectionId 있음: 해당 섹션 이미지 재생성 (prompt 로 프롬프트 수정 가능)
 * - skip: true → 이미지 단계를 건너뜀
 */
export const POST = createStepRoute(imageRequestSchema, async (ctx, body) => {
  if (body.skip) {
    await skipImages(ctx)
    return { section: null, image: null, remaining: 0 }
  }
  if (body.sectionId) return regenerateSectionImage(ctx, body.sectionId, body.prompt)
  return runNextImage(ctx)
})
