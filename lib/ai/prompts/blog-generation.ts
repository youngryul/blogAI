import type { PromptParts } from "@/lib/ai/client"
import {
  EDITOR_PRINCIPLES,
  FACT_OPINION_RULES,
  FORBIDDEN_RULES,
  bulletList,
  describeContentType,
  describeCta,
  describeLength,
  formatProductFacts,
  type ProductFacts,
} from "@/lib/ai/prompts/shared"
import type {
  ContentStrategy,
  ContentType,
  CtaStrength,
  KeywordAnalysis,
  LengthOption,
  ProductAnalysis,
} from "@/types"

export interface BlogPromptInput {
  product: ProductFacts
  analysis: ProductAnalysis
  keywords: KeywordAnalysis
  strategy: ContentStrategy
  title: string
  contentType: ContentType
  brandTone: string | null
  lengthOption: LengthOption
  targetChars: number
  ctaStrength: CtaStrength
  maxAffiliateLinks: number
}

/** 네이버 블로그 본문 작성 규칙 (섹션 재생성에서도 재사용) */
export const WRITING_RULES = `
[본문 작성 규칙]
- 자연스러운 한국어, 네이버 블로그에서 편하게 읽히는 문체 (~요/~습니다 체 중 하나로 일관되게).
- 한 문단은 2~4문장. 문단 사이는 빈 줄("\\n\\n")로 구분한다. 5문장 이상 긴 문단 금지.
- 필요하면 "- " 로 시작하는 짧은 목록을 사용할 수 있다 (한 섹션에 최대 1개 목록).
- 소제목은 짧고 명확하게(10~25자), 질문형/체크포인트형을 적절히 섞는다.
- 같은 표현, 같은 문장 구조(예: "~는 ~입니다. ~는 ~입니다.")를 반복하지 않는다.
- 메인 키워드는 도입·본문·마무리에 걸쳐 자연스럽게 3~6회 정도만 사용한다. 기계적 반복 금지.
- 마크다운 문법(#, **, [], ![]) 과 URL 을 본문에 쓰지 않는다.
- "여러분", "오늘은 ~에 대해 알아보겠습니다" 같은 상투적 AI 문체를 남발하지 않는다.
- 검색 사용자의 문제 해결을 우선하고, 제품 소개는 그 흐름 안에서 자연스럽게 연결한다.
- 각 섹션 첫 문장은 독자가 계속 읽고 싶게 만드는 훅(공감 질문, 의외의 사실, 구체적 상황)으로 시작한다.
- 장점은 "그래서 독자의 하루가 어떻게 달라지는지"까지 써야 완성이다.
`.trim()

export function createBlogPrompt(input: BlogPromptInput): PromptParts {
  return {
    instructions: `
${EDITOR_PRINCIPLES}

${FORBIDDEN_RULES}

${FACT_OPINION_RULES}

${WRITING_RULES}

[작업]
주어진 제목과 콘텐츠 전략에 맞춰 네이버 블로그 게시글 본문을 구조화된 형태로 작성한다.

- intro: 도입부 2~3문단. 모바일에서 첫 화면에 보이는 영역이라 이탈을 막는 것이 핵심이다.
  * 첫 문장: 독자가 지금 겪는 불편을 콕 집는 공감 문장 ("~할 때마다 ~해서 답답하셨죠?" 처럼).
  * 둘째 문단: 이 글을 끝까지 읽으면 얻는 것(실패 없이 고르는 기준, 이 상품이 맞는지 판단)을 약속한다.
  * 상품명을 도입부에서 한 번 노출해 '바로 확인하고 싶은 독자'가 첫 링크까지 내려가게 만든다.
- sections: 전략의 sectionPlan 순서를 기본으로 작성한다 (소제목은 다듬어도 된다).
  * 소제목은 클릭해서 펼쳐 보고 싶은 문장형으로 (예: "작은 방이라면 이것부터 보세요", "가격이 아깝지 않은 이유 3가지").
  * body: 섹션 본문 (문단 구분은 빈 줄)
  * 상품 소개 섹션: 핵심 장점 3가지를 '기능 → 독자 이득 → 사용 장면' 구조로 쓰고, 구매 전 걱정 1~2개를 미리 해소한다.
  * insertAffiliateLink: 이 섹션 뒤에 쇼핑 커넥트 상품 링크 안내를 넣을지 여부.
    - 최대 ${input.maxAffiliateLinks}개 섹션만 true.
    - 권장 위치: ① 상품을 처음 소개하는 섹션 뒤(가장 클릭이 많이 나는 위치) ② 장점·걱정 해소가 끝난 직후 ③ 글 마지막 정리 섹션 뒤.
    - 링크가 들어가는 섹션의 마지막 문장은 '클릭할 이유'로 끝낸다 (예: 지금 가격과 옵션 구성을 확인해 보면 판단이 훨씬 쉬워요).
    - 링크 URL 이나 버튼 문구는 본문에 쓰지 않는다. 시스템이 자동 삽입한다.
- conclusion: 마무리 1~2문단. "이런 분께는 확실히 추천" 3가지 상황을 짧게 정리해 독자가 자기 얘기라고 느끼게 하고,
  맞지 않을 수 있는 경우 1가지를 솔직하게 덧붙여 신뢰를 높인 뒤, 마지막 문장은 링크 확인을 권하는 행동 유도로 끝낸다.
- hashtags: 네이버 블로그 해시태그 6~10개. '#' 없이 단어만. 띄어쓰기 없이. 메인/보조 키워드 중심.
- 경제적 이해관계(광고) 표시 문구는 시스템이 따로 넣으므로 본문에 쓰지 않는다.

[CTA 강도] ${describeCta(input.ctaStrength)}
`.trim(),
    input: `
[확정된 제목] ${input.title}

${formatProductFacts(input.product)}

[상품 분석]
- 장점:
${bulletList(input.analysis.mainBenefits)}
- 구매 시 고민:
${bulletList(input.analysis.concerns)}
- 활용 상황:
${bulletList(input.analysis.useCases)}

[키워드]
- 메인 키워드: ${input.keywords.mainKeyword}
- 보조 키워드: ${input.keywords.secondaryKeywords.join(", ")}
- 롱테일 키워드(1~2개만 자연스럽게 활용): ${input.keywords.longtailKeywords.join(", ")}
- 검색 의도: ${input.keywords.searchIntent}
- 독자 질문 (본문에서 답해 줄 것):
${bulletList(input.keywords.userQuestions)}

[콘텐츠 전략]
- 핵심 관점: ${input.strategy.primaryAngle}
- 독자: ${input.strategy.targetReader}
- 독자 문제: ${input.strategy.readerProblem}
- 글의 목표: ${input.strategy.articleGoal}
- 섹션 계획:
${input.strategy.sectionPlan.map((s, i) => `  ${i + 1}. ${s.heading} — ${s.purpose}`).join("\n")}

[글 설정]
- 콘텐츠 유형: ${describeContentType(input.contentType)}
- 글 길이: ${describeLength(input.lengthOption, input.targetChars)}
- 브랜드 톤: ${input.brandTone || "친한 언니·형이 꼼꼼히 비교해서 알려 주는 듯한 친근하고 확신 있는 톤"}
`.trim(),
  }
}
