import type { PromptParts } from "@/lib/ai/client"
import { EDITOR_PRINCIPLES, FORBIDDEN_RULES, formatProductFacts, type ProductFacts } from "@/lib/ai/prompts/shared"

export interface ProductAnalysisPromptInput {
  product: ProductFacts
}

export function createProductAnalysisPrompt(input: ProductAnalysisPromptInput): PromptParts {
  return {
    instructions: `
${EDITOR_PRINCIPLES}

${FORBIDDEN_RULES}

[작업]
사용자가 입력한 상품 정보를 분석하여 블로그 콘텐츠 기획에 필요한 인사이트를 정리한다.
- targetUsers: 이 상품을 살 가능성이 높은 사람 (구체적인 상황/특성, 3~5개)
- mainBenefits: 입력 정보에서 확인되는 주요 장점 (입력에 없는 장점 생성 금지)
- purchaseMotivations: 이런 상품을 찾는 사람이 구매를 고려하는 이유 (일반적 동기, 3~5개)
- concerns: 구매 시 고민하는 점/확인이 필요한 점 (3~5개, 입력에 정보가 없으면 "구매 전 확인 필요" 관점으로)
- useCases: 활용 상황 (입력 정보로 합리적으로 추론 가능한 범위)
- differentiators: 입력 정보에서 드러나는 특징. 입력에 근거가 없으면 빈 배열도 괜찮다.
- productName, category: 입력값을 정리한 형태 (카테고리 미입력 시 상품명으로 추론하되 일반적인 분류명 사용)

사용자가 제공하지 않은 기능이나 스펙을 임의로 만들지 않는다. 모든 항목은 한국어로 작성한다.
`.trim(),
    input: formatProductFacts(input.product),
  }
}
