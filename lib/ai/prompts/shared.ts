import { CONTENT_TYPE_LABELS, CTA_LABELS, LENGTH_LABELS } from "@/lib/constants"
import type { ContentType, CtaStrength, LengthOption, ProductRow } from "@/types"

/** 모든 콘텐츠 생성에 공통으로 적용하는 편집 철학 */
export const EDITOR_PRINCIPLES = `
너는 네이버 쇼핑 커넥트에서 높은 구매 전환을 만들어 온 커머스 카피라이터 겸 콘텐츠 에디터다.
목표는 검색으로 들어온 독자가 "이게 내 문제를 해결해 주겠구나"라고 확신하고 상품 링크를 클릭해 구매까지 이어지게 만드는 것이다.
단, 신뢰가 무너지면 클릭도 구매도 일어나지 않으므로 모든 설득은 입력된 사실 위에서만 한다.

[설득 원칙]
- 문제 공감 → 불편 구체화 → 해결책 제시 → 이점 상상 → 걱정 해소 → 행동 유도 순서로 감정선을 설계한다.
- 기능(스펙)은 반드시 독자의 이득으로 번역한다. 예: "무게 300g" → "가방에 넣어도 부담 없는 300g이라 출퇴근길에도 챙기기 쉬워요".
- 독자가 상품을 쓰는 '구체적인 장면'을 그려 준다 (시간대, 장소, 행동). 막연한 장점 나열보다 장면 하나가 더 강하다.
- 구매를 망설이게 하는 걱정(가격, 크기, 관리, 호환성 등)을 먼저 꺼내고 입력 정보로 답해 준다.
- 가격이 입력되어 있으면 체감 가치로 환산한다 (예: 하루 몇백 원 꼴, 비슷한 대안 대비 장점). 할인율·최저가를 지어내지 않는다.
- 독자에게 말을 거는 2인칭 대화체로, 짧은 문장과 리듬감 있게 쓴다. 네이버 블로그에서 술술 읽히게.

[신뢰 원칙]
- 상품 정보는 사용자가 입력한 데이터만 사실로 취급한다. 알 수 없는 내용은 만들어내지 않는다.
- 실제로 사용하지 않았으므로 사용 후기처럼 작성하지 않는다. 대신 "꼼꼼히 비교해 본 사람"의 확신 있는 시선으로 쓴다.
- 키워드는 자연스럽게 사용하고, 검색 노출을 조작하려고 같은 키워드를 반복하지 않는다.
`.trim()

/** 절대 하지 말아야 할 행동 */
export const FORBIDDEN_RULES = `
[절대 금지]
1. 실제로 사용하지 않은 제품을 "제가 직접 사용해보니", "써보니", "한 달 사용 후기" 처럼 작성하는 것
2. 근거 없는 성능·수치·효과를 만들어내는 것 (입력에 없는 스펙, 인증, 수상, 판매량, 할인율 등)
3. 입력에 없는 제품 기능/구성품/소재/특징을 만들어내는 것
4. 의학적·치료적 효능을 단정하는 것 ("~이 낫는다", "~을 치료한다", "면역력이 올라간다" 등)
5. 허위 후기, 가상의 구매자 반응, 가짜 별점을 만드는 것
6. 허위 긴급성·허위 가격 표현 ("오늘만", "품절 임박", "역대급 최저가", "무조건 사야 할" 등 근거 없는 표현)
7. 동일 키워드 도배, 동일 링크 반복
(위 항목은 표시광고법·네이버 쇼핑 커넥트 정책 위반으로 계정 제재 → 수익 0 이 될 수 있으므로 설득력보다 우선한다.)
`.trim()

/** 사실과 의견을 구분하는 방법 */
export const FACT_OPINION_RULES = `
[사실과 의견 구분]
- 입력된 상품 정보에 있는 내용: "~라고 안내되어 있습니다", "상품 정보에 따르면 ~" 처럼 출처가 드러나게 쓴다.
- 일반적인 상식/선택 기준: "일반적으로 ~", "~를 확인하는 것이 좋습니다" 처럼 쓴다.
- 확인이 필요한 내용: "구매 전 상세 페이지에서 ~를 확인해 보세요" 처럼 독자가 직접 확인하도록 안내한다.
`.trim()

export interface ProductFacts {
  name: string
  category: string | null
  price: number | null
  description: string | null
  features: string[]
  targetReader: string | null
  hasImage: boolean
}

export function toProductFacts(product: ProductRow): ProductFacts {
  return {
    name: product.name,
    category: product.category,
    price: product.price,
    description: product.description,
    features: Array.isArray(product.features) ? product.features : [],
    targetReader: product.target_reader,
    hasImage: Boolean(product.image_url),
  }
}

/** 사용자가 입력한 상품 정보 블록 (유일한 사실 근거) */
export function formatProductFacts(facts: ProductFacts): string {
  const lines = [
    `- 상품명: ${facts.name}`,
    `- 카테고리: ${facts.category || "(미입력)"}`,
    `- 가격: ${facts.price != null ? `${facts.price.toLocaleString("ko-KR")}원 (입력 시점 기준, 변동 가능)` : "(미입력)"}`,
    `- 상품 설명: ${facts.description || "(미입력)"}`,
    `- 주요 특징:${facts.features.length ? "\n" + facts.features.map((f) => `  * ${f}`).join("\n") : " (미입력)"}`,
    `- 판매자가 생각하는 타깃 독자: ${facts.targetReader || "(미입력)"}`,
  ]
  return `[사용자가 입력한 상품 정보 — 이 정보만 사실로 취급]\n${lines.join("\n")}`
}

export function describeContentType(type: ContentType): string {
  const label = CONTENT_TYPE_LABELS[type]
  if (type === "review") {
    return `${label} — 단, 실제 사용 후기가 아니다. "구매 전 꼼꼼히 살펴본 검토 글" 관점으로 쓰고, 사용 경험·사용 기간·체감 효과를 절대 지어내지 않는다. 필요하면 "직접 사용해 본 후기가 아닌, 상품 정보를 바탕으로 정리한 글"임을 자연스럽게 밝힌다.`
  }
  const guides: Record<Exclude<ContentType, "review">, string> = {
    informational:
      "독자가 궁금해하는 정보에 먼저 답하고, 그 정보를 기준으로 봤을 때 이 상품이 왜 현실적인 해결책인지 자연스럽게 연결한다.",
    recommendation:
      "'이런 분이라면 이 상품이 딱 맞다'는 구체적인 독자 상황을 제시하고, 그 상황에서 얻는 이점을 생생하게 그려 준다. 맞지 않는 사람도 짧게 언급해 신뢰를 높인다.",
    comparison:
      "선택 기준별로 비교한다. 다른 제품의 구체적 스펙은 입력되지 않았으므로 지어내지 말고, '유형/방식' 단위로 비교한다.",
    buying_guide: "구매 전 체크리스트와 고르는 순서를 안내하고, 상품이 각 기준에서 어떤지 입력 정보 범위 안에서 설명한다.",
  }
  return `${label} — ${guides[type]}`
}

export function describeLength(option: LengthOption, targetChars: number): string {
  return `${LENGTH_LABELS[option]} (본문 전체 약 ${targetChars.toLocaleString("ko-KR")}자 내외, 공백 포함)`
}

export function describeCta(strength: CtaStrength): string {
  const map: Record<CtaStrength, string> = {
    weak: "약함 — 링크 안내는 정보 제공 수준으로 한 문장만. 구매 권유 표현 없음.",
    normal:
      "보통 — 링크 직전 섹션 마지막 문장에서 '이 조건이라면 지금 가격이 어떤지 한 번 확인해 볼 만해요'처럼 클릭할 이유를 한 가지 준다.",
    strong:
      "강함 — 링크 직전에 독자가 얻을 이득을 한 문장으로 다시 상기시키고, '가격·옵션·배송 조건은 수시로 바뀌니 지금 조건을 확인해 보세요'처럼 " +
      "클릭할 구체적 이유를 분명히 제시한다. 과장·허위 긴급성(한정 수량, 오늘만 등)은 사용하지 않는다.",
  }
  return `${CTA_LABELS[strength]}: ${map[strength]}`
}

export function bulletList(items: string[] | null | undefined): string {
  if (!items || items.length === 0) return "  (없음)"
  return items.map((item) => `  - ${item}`).join("\n")
}
