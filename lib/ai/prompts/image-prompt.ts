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

/**
 * 모든 이미지 프롬프트 끝에 붙는 실사 촬영 규칙 (영문 — 이미지 모델 준수율이 높음).
 * "일러스트/3D 렌더 느낌"을 막고, 실제 카메라로 찍은 커머스·라이프스타일 사진처럼 보이게 한다.
 */
export const IMAGE_PHOTOREAL_SUFFIX =
  "Ultra photorealistic photograph, shot on a full-frame DSLR (Canon EOS R5) with a 50mm f/1.8 lens, " +
  "shallow depth of field with creamy bokeh, soft natural window light, true-to-life colors, " +
  "realistic material textures (fabric weave, matte plastic, brushed metal, glass reflections), subtle real-world imperfections, " +
  "premium Korean lifestyle commerce photography, magazine-quality composition, sharp focus on the product, 8k detail. " +
  "NOT an illustration, NOT a 3D render, NOT CGI, no cartoon, no painting style, no over-saturated HDR look."

/** 텍스트·상표·얼굴 관련 안전 규칙 */
export const IMAGE_SAFETY_SUFFIX =
  "No added text, no captions, no letters, no watermarks, no added logos. " +
  "Hands and partial bodies are fine, but no close-up human faces."

/** 실제 상품 사진을 참조 이미지로 넣을 때 — 상품 외형을 바꾸지 않도록 고정 */
export const PRODUCT_REFERENCE_SUFFIX =
  "Use the provided reference photo as the exact product: keep its shape, color, proportions, materials and details identical. " +
  "Do not redesign, restyle or replace the product. Place this exact product naturally into the described real-life scene " +
  "with physically correct lighting, contact shadows and reflections so it looks like a real photo taken on location."

/** 상품 사진이 없을 때 — 특정 브랜드 제품을 복제하지 않도록 */
export const GENERIC_PRODUCT_SUFFIX =
  "Show a realistic, unbranded product of this type; do not replicate any specific commercial brand design."

export function createImagePromptPlanPrompt(input: ImagePromptInput): PromptParts {
  return {
    instructions: `
너는 네이버 쇼핑 커넥트 블로그의 상품 사진을 기획하는 커머스 포토 디렉터다.
목표는 독자가 사진을 보는 순간 "이거 내 방에 두고 싶다 / 나도 이렇게 쓰고 싶다"고 느껴서 링크를 클릭하게 만드는 것이다.
본문 섹션 중 이미지가 필요한 곳을 고르고, 이미지 생성 모델에 넣을 실사 사진 프롬프트를 작성한다.

[규칙]
- 정확히 ${input.imageCount}개의 이미지를 계획한다. 서로 다른 섹션을 선택한다 (sectionIndex 는 주어진 index 값).
- kind 는 아래 4가지를 가능한 한 하나씩 사용한다:
  * hero: 대표 썸네일 — 글 첫 섹션. 상품이 화면 중앙에서 가장 돋보이는 '갖고 싶은' 컷.
    고급스러운 배경(원목 테이블, 린넨 패브릭, 대리석 등), 상품에 초점, 배경은 부드럽게 흐림.
  * usage: 사용 장면 — 상품이 실제 한국 생활 공간에서 쓰이는 순간. 손이 상품을 잡거나 조작하는 장면 등 '내가 쓰는 모습'이 그려지게.
  * explain: 디테일 컷 — 상품의 특징(소재, 버튼, 구조, 크기감)을 보여주는 매크로/클로즈업. 크기 비교용 일상 소품(머그컵, 스마트폰 등)을 함께 배치.
  * summary: 분위기 컷 — 상품이 놓인 정돈된 공간의 따뜻한 분위기. 독자가 '구매 후의 내 일상'을 상상하게.
- prompt 는 한국어로 '사진 촬영 지시서'처럼 구체적으로 작성한다. 반드시 포함:
  1) 피사체와 배치 2) 장소/배경 3) 조명(시간대, 방향) 4) 카메라 앵글·거리(예: 45도 탑뷰, 아이레벨, 매크로) 5) 분위기·색감
  * 예: "오후 4시 창가로 들어오는 따뜻한 햇살, 화이트 톤 원룸 원목 책상 위 노트북 옆에 놓인 미니 가습기에서 은은하게 올라오는 수증기,
    아이레벨 50mm 렌즈, 배경은 부드럽게 흐려진 침대와 커튼, 아늑하고 깨끗한 분위기"
- 상품 설명에 적힌 색상·형태·소재가 있으면 프롬프트에 그대로 반영한다. 적혀 있지 않은 기능이나 부속품은 만들지 않는다.
${input.hasProductImage
  ? "- 실제 상품 사진이 참조 이미지로 함께 들어간다. 프롬프트에서 상품은 '이 제품'이라고만 지칭하고 외형을 새로 묘사하지 말고, 배경·조명·연출만 지시한다."
  : "- 실제 상품 사진이 없다. 카테고리와 설명을 근거로 상품 유형을 현실적으로 묘사하되 특정 브랜드 디자인을 따라 하지 않는다."}
- 이미지 안에 글자, 가격표, 로고, 워터마크를 넣지 않는다. 사람 얼굴 클로즈업은 피한다(손, 뒷모습은 가능).
- 의학적 효과를 암시하는 장면(치료, 병원 등)이나 비현실적인 효과(빛나는 파동, 마법 같은 연출)는 만들지 않는다.
- altText: 검색 노출에 도움이 되도록 메인 상품 유형 키워드를 포함한 이미지 설명 한 문장.
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
export function buildFinalImagePrompt(prompt: string, options: { withProductReference?: boolean } = {}): string {
  const productRule = options.withProductReference ? PRODUCT_REFERENCE_SUFFIX : GENERIC_PRODUCT_SUFFIX
  return [prompt.trim(), IMAGE_PHOTOREAL_SUFFIX, productRule, IMAGE_SAFETY_SUFFIX].join("\n\n")
}
