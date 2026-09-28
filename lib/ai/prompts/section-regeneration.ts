import type { PromptParts } from "@/lib/ai/client"
import {
  EDITOR_PRINCIPLES,
  FACT_OPINION_RULES,
  FORBIDDEN_RULES,
  describeContentType,
  formatProductFacts,
  type ProductFacts,
} from "@/lib/ai/prompts/shared"
import { WRITING_RULES } from "@/lib/ai/prompts/blog-generation"
import type { ContentType } from "@/types"

export interface SectionRegenerationPromptInput {
  product: ProductFacts
  title: string
  mainKeyword: string
  contentType: ContentType
  brandTone: string | null
  outline: string[]
  section: { heading: string; body: string }
  previousHeading: string | null
  nextHeading: string | null
  /** 사용자가 입력한 수정 요청 (선택) */
  instruction: string | null
}

export function createSectionRegenerationPrompt(input: SectionRegenerationPromptInput): PromptParts {
  return {
    instructions: `
${EDITOR_PRINCIPLES}

${FORBIDDEN_RULES}

${FACT_OPINION_RULES}

${WRITING_RULES}

[작업]
블로그 글의 특정 섹션 하나만 다시 작성한다.
- 글 전체 흐름(앞뒤 섹션)과 자연스럽게 이어지도록 한다.
- 기존 섹션과 분량은 비슷하게 유지한다 (사용자 요청이 있으면 요청을 우선).
- heading(소제목)과 body(본문, 문단은 빈 줄로 구분)만 반환한다.
- 링크 URL, 광고 표시 문구, 마크다운은 쓰지 않는다.
`.trim(),
    input: `
${formatProductFacts(input.product)}

[글 제목] ${input.title}
[메인 키워드] ${input.mainKeyword}
[콘텐츠 유형] ${describeContentType(input.contentType)}
[브랜드 톤] ${input.brandTone || "친근하고 차분한 정보 전달형"}

[글 전체 목차]
${input.outline.map((h, i) => `${i + 1}. ${h}`).join("\n")}

[이전 섹션] ${input.previousHeading ?? "(없음 — 첫 섹션)"}
[다음 섹션] ${input.nextHeading ?? "(없음 — 마지막 섹션)"}

[다시 쓸 섹션 — 기존 내용]
소제목: ${input.section.heading}
본문:
${input.section.body}

[사용자 수정 요청]
${input.instruction?.trim() || "(없음 — 더 자연스럽고 읽기 쉽게 다시 작성)"}
`.trim(),
  }
}
