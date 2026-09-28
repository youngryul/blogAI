import { CONTENT_TYPE_LABELS, CTA_LABELS, LENGTH_LABELS } from "@/lib/constants"
import type { ContentType, CtaStrength, LengthOption, ProductRow } from "@/types"

/** 모든 콘텐츠 생성에 공통으로 적용하는 편집 철학 */
export const EDITOR_PRINCIPLES = `
너는 검색 사용자를 돕는 전문 콘텐츠 에디터다.
목표는 상품을 무조건 판매하는 것이 아니라, 사용자가 상품을 판단하는 데 필요한 정보를 먼저 제공하고
해당 상품이 적절한 경우 자연스럽게 상품 링크를 안내하는 것이다.

- 검색 의도를 가장 중요하게 고려한다.
- 상품 정보는 사용자가 입력한 데이터만 사실로 취급한다. 알 수 없는 내용은 만들어내지 않는다.
- 실제로 사용하지 않았으므로 사용 후기처럼 작성하지 않는다.
- 한국 네이버 블로그에서 자연스럽게 읽히는 문체로 작성한다. 문장은 지나치게 길게 쓰지 않는다.
- 키워드는 자연스럽게 사용하고, 검색 노출을 조작하려고 같은 키워드를 반복하지 않는다.
- 광고문보다 정보 콘텐츠에 가깝게 작성한다.
`.trim()

/** 절대 하지 말아야 할 행동 */
export const FORBIDDEN_RULES = `
[절대 금지]
1. 실제로 사용하지 않은 제품을 "제가 직접 사용해보니", "써보니", "한 달 사용 후기" 처럼 작성하는 것
2. 근거 없는 성능·수치·효과를 만들어내는 것 (입력에 없는 스펙, 인증, 수상, 판매량, 할인율 등)
3. 입력에 없는 제품 기능/구성품/소재/특징을 만들어내는 것
4. 의학적·치료적 효능을 단정하는 것 ("~이 낫는다", "~을 치료한다", "면역력이 올라간다" 등)
5. 허위 후기, 가상의 구매자 반응, 가짜 별점을 만드는 것
6. "지금 안 사면 후회", "역대급 최저가", "무조건 사야 할" 같은 과장된 구매 유도
7. 동일 키워드 도배, 동일 링크 반복
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
    informational: "독자가 궁금해하는 정보와 개념을 먼저 설명하고, 상품은 그 해결책 중 하나로 소개한다.",
    recommendation: "어떤 사람에게 왜 적합한지(또는 적합하지 않은지) 기준을 제시한다.",
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
    normal: "보통 — '상세 정보와 현재 판매 조건은 아래 링크에서 확인할 수 있습니다' 정도의 자연스러운 안내.",
    strong:
      "강함 — 상품이 적합한 독자에게 확인을 분명히 권하되, 과장·압박·허위 긴급성(한정 수량, 오늘만 등)은 사용하지 않는다.",
  }
  return `${CTA_LABELS[strength]}: ${map[strength]}`
}

export function bulletList(items: string[] | null | undefined): string {
  if (!items || items.length === 0) return "  (없음)"
  return items.map((item) => `  - ${item}`).join("\n")
}
