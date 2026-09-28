import type { PromptParts } from "@/lib/ai/client"
import { bulletList, describeContentType } from "@/lib/ai/prompts/shared"
import type { ContentStrategy, ContentType, KeywordAnalysis } from "@/types"

export interface TitlePromptInput {
  productName: string
  keywords: KeywordAnalysis
  strategy: ContentStrategy
  contentType: ContentType
  count: number
}

export function createTitlePrompt(input: TitlePromptInput): PromptParts {
  return {
    instructions: `
너는 네이버 블로그 콘텐츠 에디터다. 검색 사용자가 실제로 클릭하고 싶어지는, 정직한 블로그 제목을 만든다.

[제목 조건]
- 정확히 ${input.count}개를 만든다. 서로 다른 관점(angle)을 사용한다.
- 메인 키워드 "${input.keywords.mainKeyword}" 를 자연스럽게 포함한다 (앞쪽 배치 권장, 억지 반복 금지).
- 클릭베이트 금지: "충격", "경악", "무조건", "역대급", "이것만 사면 끝" 등 사용 금지.
- 과도한 특수문자 금지: 이모지, !!, ??, ★, ♥, 【】 사용 금지. 쉼표(,)와 숫자는 사용 가능.
- 지나치게 광고성인 제목 금지 (최저가, 할인, 강력추천 등).
- 실제 사용 후기처럼 보이는 제목 금지 ("써보니", "내돈내산", "솔직후기" 등).
- 15~35자 내외의 한국어.
- 예시 스타일: "무선 가습기 추천, 작은 방에서 고를 때 확인할 5가지"

[필드]
- title: 제목
- angle: 이 제목의 관점 (예: 체크리스트형, 상황 공감형, 비교 기준형)
- keywordUsage: 제목에 실제 포함된 키워드 목록
`.trim(),
    input: `
- 상품명: ${input.productName}
- 콘텐츠 유형: ${describeContentType(input.contentType)}
- 메인 키워드: ${input.keywords.mainKeyword}
- 보조 키워드: ${input.keywords.secondaryKeywords.join(", ")}
- 롱테일 키워드: ${input.keywords.longtailKeywords.join(", ")}
- 검색 의도: ${input.keywords.searchIntent}
- 글의 핵심 관점: ${input.strategy.primaryAngle}
- 독자 문제: ${input.strategy.readerProblem}
- 섹션 구성:
${bulletList(input.strategy.sectionPlan.map((s) => s.heading))}
`.trim(),
  }
}
