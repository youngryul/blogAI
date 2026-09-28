import type { PromptParts } from "@/lib/ai/client"

export interface ImagePromptInput {
  productName: string
  category: string | null
  productDescription: string | null
  hasProductImage: boolean
  title: string
  sections: { index: number; heading: string; excerpt: string }[]
  imageCount: number
}

/** 모든 이미지 프롬프트 끝에 붙는 안전 규칙 (영문 — 이미지 모델 준수율이 높음) */
export const IMAGE_SAFETY_SUFFIX =
  "Realistic Korean lifestyle blog photo style, natural lighting, not an advertisement. " +
  "No text, no letters, no logos, no brand names, no watermarks. " +
  "Show a generic, unbranded object; do not replicate or imitate any specific commercial product design. " +
  "No people's faces in close-up."

export function createImagePromptPlanPrompt(input: ImagePromptInput): PromptParts {
  return {
    instructions: `
너는 네이버 블로그 글에 들어갈 이미지를 기획하는 에디터다.
본문 섹션 중 이미지가 필요한 곳을 고르고, 이미지 생성 모델에 넣을 프롬프트를 작성한다.

[규칙]
- 정확히 ${input.imageCount}개의 이미지를 계획한다. 서로 다른 섹션을 선택한다 (sectionIndex 는 주어진 index 값).
- kind 는 아래 4가지를 가능한 한 하나씩 사용한다:
  * hero: 대표 이미지 — 글 첫 섹션에 배치, 주제를 한눈에 보여주는 장면
  * explain: 본문 설명 이미지 — 선택 기준/개념을 보여주는 장면 (텍스트·도표 없이 사물 위주)
  * usage: 사용 상황 이미지 — 제품이 쓰일 법한 실제 생활 공간/상황
  * summary: 정리 이미지 — 마지막 부근 섹션, 차분한 정리 분위기
- prompt 는 한국어로 구체적으로 작성한다: 장소, 조명, 구도, 분위기, 사물 배치.
  * 예: "따뜻한 자연광이 들어오는 작은 한국 원룸 책상 위에 놓인 미니 가습기, 현실적인 블로그 사진 스타일, 과도한 광고 느낌 없음"
- 실제 상품의 외형을 정확히 알 수 없으므로 특정 제품(브랜드) 복제품처럼 묘사하지 않는다.
  로고, 상표, 제품명, 글자를 넣지 않는다.
${input.hasProductImage
  ? "- 사용자가 상품 대표 이미지를 가지고 있다. 생성 이미지는 상품 사진을 대체하지 않는 '분위기/상황' 컷으로 기획한다."
  : "- 상품 이미지가 제공되지 않았다. 제품 클로즈업보다 컨셉 이미지 / 라이프스타일 이미지 위주로 기획한다."}
- 사람의 얼굴 클로즈업, 과장된 광고 연출, 비현실적인 효과 표현을 피한다.
- 의학적 효과를 암시하는 장면(치료, 병원 등)은 만들지 않는다.
- altText: 이미지 설명(대체 텍스트) 한 문장.
`.trim(),
    input: `
- 글 제목: ${input.title}
- 상품명(참고용, 이미지에 글자로 넣지 말 것): ${input.productName}
- 카테고리: ${input.category || "(미입력)"}
- 상품 설명: ${input.productDescription || "(미입력)"}

[섹션 목록]
${input.sections.map((s) => `- index ${s.index}: ${s.heading}\n  요약: ${s.excerpt}`).join("\n")}
`.trim(),
  }
}

/** 이미지 모델에 전달할 최종 프롬프트 */
export function buildFinalImagePrompt(prompt: string): string {
  return `${prompt.trim()}\n\n${IMAGE_SAFETY_SUFFIX}`
}
