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
import type { BlogContent, ContentType } from "@/types"

export interface ContentReviewPromptInput {
  /** optimize: 개선본까지 작성 / evaluate: 현재 글 평가만 */
  mode: "optimize" | "evaluate"
  product: ProductFacts
  mainKeyword: string
  searchIntent: string
  contentType: ContentType
  content: BlogContent
  maxAffiliateLinks: number
  /** 규칙 기반 사전 점검 결과 (문단 길이, 키워드 횟수 등) */
  lintFindings: string[]
}

const OPTIMIZE_TASK = `
[작업]
너는 콘텐츠 검수 에디터다. 아래 블로그 글을 검수 기준에 따라 점검하고, 문제를 고친 개선본(optimizedContent)을 만든다.
- issues: 원문에서 발견한 문제 (개선본에서 수정한 내용 포함)
- score, metrics: 개선본(optimizedContent) 기준으로 평가한다.
`.trim()

const EVALUATE_TASK = `
[작업]
너는 콘텐츠 검수 에디터다. 아래 블로그 글을 수정하지 말고, 검수 기준에 따라 현재 상태를 평가만 한다.
- issues: 현재 글에 남아 있는 문제
- score, metrics: 현재 글 기준으로 평가한다.
`.trim()

const OPTIMIZE_RULES = `
[개선본 작성 규칙]
- 섹션 id, 섹션 개수, 순서, insertAffiliateLink 값은 그대로 유지한다 (단, 링크 개수 초과 시에만 false 로 조정).
- imagePrompt, imageUrl 은 입력값 그대로 둔다.
- disclosure 는 입력값을 한 글자도 바꾸지 않는다. 비어 있으면 issues 에 missing_disclosure 로 보고만 한다.
- 문제가 있는 문장만 최소한으로 고친다. 문제없는 문장은 그대로 둔다.
- 제목은 검색 의도와 크게 어긋날 때만 수정한다.
- 입력 정보에 없는 사실을 새로 추가하지 않는다.
`.trim()

export function createContentReviewPrompt(input: ContentReviewPromptInput): PromptParts {
  return {
    instructions: `
${EDITOR_PRINCIPLES}

${FORBIDDEN_RULES}

${FACT_OPINION_RULES}

${WRITING_RULES}

${input.mode === "optimize" ? OPTIMIZE_TASK : EVALUATE_TASK}

[검수 기준]
1. 허위 정보 (false_information)
2. 입력 정보에 없는 상품 기능/스펙 생성 (invented_feature)
3. 실제 사용하지 않았는데 사용했다고 표현 (fake_experience)
4. 키워드 과도 반복 (keyword_stuffing)
5. 부자연스러운 AI 문체 (unnatural_ai_tone)
6. 같은 문장 구조 반복 (repetitive_structure)
7. 지나친 광고 표현 (excessive_advertising)
8. 링크 반복 (link_repetition) — insertAffiliateLink 가 true 인 섹션은 최대 ${input.maxAffiliateLinks}개
9. CTA 과도 (excessive_cta)
10. 글 제목과 검색 의도 불일치 (title_intent_mismatch)
11. 지나치게 긴 문단 (long_paragraph) — 5문장 이상
12. 경제적 이해관계 문구 존재 여부 (missing_disclosure)
13. 의학적 효능 단정 (medical_claim)

[평가]
- metrics 각 항목은 0~100 정수:
  searchIntentFit(검색 의도 적합도), keywordNaturalness(키워드 자연스러움), titleFit(제목 적합도),
  readability(본문 가독성), productAccuracy(상품 정보 정확성 — 입력 정보 밖의 주장이 있으면 크게 감점),
  adTone(설득 품질 — 허위·과장 없이 공감·이득·걱정 해소로 자연스럽게 구매 욕구를 만들수록 높음, 근거 없는 과장은 크게 감점),
  ctaAppropriateness(CTA 적절성 — 링크 직전에 클릭할 이유가 분명하고 압박 없이 행동을 유도할수록 높음)
- score: 종합 점수(0~100 정수). 가중치: 상품 정보 정확성·검색 의도 적합도를 높게.
- issues: message 는 어느 부분이 왜 문제인지 구체적으로 한국어로. 문제 없으면 빈 배열.
${input.mode === "optimize" ? OPTIMIZE_RULES : ""}
`.trim(),
    input: `
${formatProductFacts(input.product)}

[메인 키워드] ${input.mainKeyword}
[검색 의도] ${input.searchIntent}
[콘텐츠 유형] ${describeContentType(input.contentType)}

[규칙 기반 사전 점검 결과]
${input.lintFindings.length ? input.lintFindings.map((f) => `- ${f}`).join("\n") : "- 특이사항 없음"}

[검수할 글(JSON)]
${JSON.stringify(input.content, null, 2)}
`.trim(),
  }
}
