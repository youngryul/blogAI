import type { PromptParts } from "@/lib/ai/client"
import { bulletList, describeContentType } from "@/lib/ai/prompts/shared"
import type { ContentStrategy, ContentType, KeywordAnalysis } from "@/types"

export interface TitlePromptInput {
  productName: string
  price?: number | null
  keywords: KeywordAnalysis
  strategy: ContentStrategy
  contentType: ContentType
  count: number
}

export function createTitlePrompt(input: TitlePromptInput): PromptParts {
  return {
    instructions: `
너는 네이버 블로그 검색 결과에서 클릭률(CTR)이 가장 높은 제목을 만드는 커머스 카피라이터다.
같은 검색 결과에 경쟁 글 10개가 나란히 있을 때, 독자가 "이건 내 얘기다" 하고 가장 먼저 누르는 제목을 만든다.

[클릭을 부르는 공식 — 후보마다 아래 중 2가지 이상 조합]
1. 구체적 숫자: "3가지", "5분 만에", "10평 원룸", 가격대("3만원대")처럼 막연함을 없앤다. (가격대는 입력 가격이 있을 때만)
2. 독자 상황 지목: "자취생", "아기 있는 집", "작은 방", "출퇴근러"처럼 타깃을 콕 집는다.
3. 손해 회피: "사기 전에 꼭 확인할", "후회 없이 고르는", "모르고 사면 아쉬운" 등 실패를 피하고 싶은 심리.
4. 결과·이득 약속: "~가 확 달라지는", "~걱정 끝내는", "~고민 해결" 처럼 읽고 나면 얻는 것.
5. 호기심 간극: "다들 놓치는 한 가지", "생각보다 중요한 기준" 처럼 답을 본문에 두되 제목에서 궁금하게.

[제목 조건]
- 정확히 ${input.count}개를 만든다. 서로 다른 관점(angle)을 사용한다.
- 메인 키워드 "${input.keywords.mainKeyword}" 를 반드시 그대로 포함하고 제목 앞쪽(처음 10자 안)에 둔다.
- 허위·과장 금지: "충격", "경악", "무조건", "역대급", "최저가", "품절 임박" 등 근거 없는 표현 금지 (계정 제재 위험).
- 과도한 특수문자 금지: 이모지, !!, ??, ★, ♥, 【】 사용 금지. 쉼표(,)와 숫자는 적극 사용.
- 실제 사용 후기처럼 보이는 제목 금지 ("써보니", "내돈내산", "솔직후기" 등).
- 20~35자 한국어 (모바일 검색 결과에서 잘리지 않는 길이).
- 예시 스타일:
  * "무선 가습기 추천, 원룸 자취생이 사기 전에 꼭 볼 3가지"
  * "무선 가습기 고르는 법, 3만원대로 겨울 건조함 끝내는 기준"
  * "무선 가습기 추천, 다들 놓치는 소음 기준 하나"

[필드]
- title: 제목
- angle: 이 제목의 관점 (예: 체크리스트형, 상황 공감형, 비교 기준형)
- keywordUsage: 제목에 실제 포함된 키워드 목록
`.trim(),
    input: `
- 상품명: ${input.productName}
- 가격: ${input.price != null ? `${input.price.toLocaleString("ko-KR")}원 (가격대 표현에만 활용, 정확한 금액·할인율은 제목에 쓰지 말 것)` : "(미입력 — 가격대 표현 사용 금지)"}
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
