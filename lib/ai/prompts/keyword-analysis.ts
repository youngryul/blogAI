import type { PromptParts } from "@/lib/ai/client"
import {
  EDITOR_PRINCIPLES,
  bulletList,
  describeContentType,
  formatProductFacts,
  type ProductFacts,
} from "@/lib/ai/prompts/shared"
import type { ContentType, ProductAnalysis } from "@/types"

export interface KeywordAnalysisPromptInput {
  product: ProductFacts
  analysis: ProductAnalysis
  contentType: ContentType
  mainKeywordInput: string | null
  targetReader: string | null
  /** 외부 provider(네이버 검색광고 API 등)가 제공한 지표. MVP 에서는 null */
  externalMetrics: string | null
}

export function createKeywordAnalysisPrompt(input: KeywordAnalysisPromptInput): PromptParts {
  const fixedKeyword = input.mainKeywordInput?.trim()
  return {
    instructions: `
${EDITOR_PRINCIPLES}

[작업]
네이버 검색 사용자 관점에서 이 상품과 관련된 블로그 글의 키워드와 검색 의도를 분석한다.

- mainKeyword: 실제 사용자가 네이버에서 검색할 법한 자연스러운 메인 키워드 1개 (2~4어절, 브랜드명 남용 금지)
${fixedKeyword ? `  * 사용자가 메인 키워드를 "${fixedKeyword}" 로 지정했다. 반드시 이 값을 그대로 mainKeyword 로 사용한다.` : ""}
- secondaryKeywords: 함께 쓰기 좋은 보조 키워드 4~6개
- longtailKeywords: 구체적인 상황이 담긴 롱테일 키워드 5~8개 (예: "작은 방 가습기 소음 적은")
- searchIntent: 이 키워드로 검색하는 사람이 실제로 알고 싶은 것 (1~2문장)
- searchIntentType: informational(정보 탐색) / commercial(구매 전 비교·검토) / transactional(구매 직전)
- targetReader: 이 글의 핵심 독자 1문장
- userQuestions: 검색 사용자가 가질 법한 질문 5~7개
- articleAngles: 글을 풀어갈 수 있는 관점 3~5개

[주의]
- 검색량 수치를 지어내지 않는다. 수치 데이터가 없으므로 언급하지 않는다.
- 키워드는 자연스러운 한국어 검색어 형태로 작성한다.
`.trim(),
    input: `
${formatProductFacts(input.product)}

[상품 분석 결과]
- 예상 구매자:
${bulletList(input.analysis.targetUsers)}
- 구매 동기:
${bulletList(input.analysis.purchaseMotivations)}
- 구매 시 고민:
${bulletList(input.analysis.concerns)}
- 활용 상황:
${bulletList(input.analysis.useCases)}

[콘텐츠 유형] ${describeContentType(input.contentType)}
[사용자가 지정한 타깃 독자] ${input.targetReader || "(미지정)"}
${input.externalMetrics ? `\n[외부 키워드 데이터]\n${input.externalMetrics}` : ""}
`.trim(),
  }
}
