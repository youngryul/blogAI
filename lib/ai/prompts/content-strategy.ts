import type { PromptParts } from "@/lib/ai/client"
import {
  EDITOR_PRINCIPLES,
  FORBIDDEN_RULES,
  bulletList,
  describeContentType,
  describeLength,
  formatProductFacts,
  type ProductFacts,
} from "@/lib/ai/prompts/shared"
import type { ContentType, KeywordAnalysis, LengthOption, ProductAnalysis } from "@/types"

export interface ContentStrategyPromptInput {
  product: ProductFacts
  analysis: ProductAnalysis
  keywords: KeywordAnalysis
  contentType: ContentType
  lengthOption: LengthOption
  targetChars: number
  sectionCount: number
  imageCount: number
  targetReader: string | null
  brandTone: string | null
}

export function createContentStrategyPrompt(input: ContentStrategyPromptInput): PromptParts {
  return {
    instructions: `
${EDITOR_PRINCIPLES}

${FORBIDDEN_RULES}

[작업]
상품 분석과 키워드 분석을 바탕으로 블로그 글의 콘텐츠 전략과 섹션 구성을 설계한다.

- primaryAngle: 글의 핵심 관점 1문장
- targetReader: 핵심 독자 1문장
- readerProblem: 독자가 검색한 이유가 되는 문제/고민
- articleGoal: 글을 다 읽은 독자가 얻어야 하는 것
- recommendedLength: 권장 본문 글자 수 (정수, 목표치 ${input.targetChars} 근처)
- recommendedImageCount: 권장 이미지 수 (정수, 기본 ${input.imageCount})
- sectionPlan: 본문 섹션 ${input.sectionCount}개 내외. 각 섹션은 heading(소제목 초안)과 purpose(이 섹션의 역할).
  * 도입(intro)과 마무리(conclusion)는 별도로 작성되므로 sectionPlan 에 넣지 않는다.
  * 구매 전환 흐름으로 설계한다: ① 독자 문제 공감·검색 의도 답변 → ② 이 상품 소개(2번째 섹션 이내, 늦어도 전체의 앞 절반)
    → ③ 장점을 독자 이득·사용 장면으로 풀어내기 → ④ 구매 전 걱정(가격·크기·관리 등) 해소 → ⑤ '이런 분께 추천' 정리.
  * 상품 소개는 너무 뒤로 미루지 않는다. 모바일 독자는 스크롤 중반에 대부분 이탈하므로 첫 링크 위치가 수익을 좌우한다.
  * 마지막 섹션은 '이런 분께 추천 / 구매 전 체크리스트' 처럼 결정을 돕고 링크로 이어지는 성격이 좋다.
`.trim(),
    input: `
${formatProductFacts(input.product)}

[상품 분석]
- 장점:
${bulletList(input.analysis.mainBenefits)}
- 고민 포인트:
${bulletList(input.analysis.concerns)}
- 활용 상황:
${bulletList(input.analysis.useCases)}

[키워드 분석]
- 메인 키워드: ${input.keywords.mainKeyword}
- 보조 키워드: ${input.keywords.secondaryKeywords.join(", ")}
- 검색 의도(${input.keywords.searchIntentType}): ${input.keywords.searchIntent}
- 사용자 질문:
${bulletList(input.keywords.userQuestions)}
- 가능한 관점:
${bulletList(input.keywords.articleAngles)}

[글 설정]
- 콘텐츠 유형: ${describeContentType(input.contentType)}
- 글 길이: ${describeLength(input.lengthOption, input.targetChars)}
- 타깃 독자(사용자 지정): ${input.targetReader || "(미지정)"}
- 브랜드 톤: ${input.brandTone || "친근하고 차분한 정보 전달형"}
`.trim(),
  }
}
