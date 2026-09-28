/**
 * Mock Mode 결과 생성기.
 * OPENAI_API_KEY 가 없는 로컬 환경에서도 전체 플로우(UI/DB)를 개발·테스트할 수 있게 한다.
 * 결과물은 입력값을 조합한 샘플이며 실제 AI 품질을 대표하지 않는다.
 */
import type { ProductFacts } from "@/lib/ai/prompts/shared"
import type {
  BlogContent,
  BlogDraft,
  ContentStrategy,
  ImageKind,
  ImagePromptPlan,
  KeywordAnalysis,
  ProductAnalysis,
  RegeneratedSection,
  ReviewResult,
  TitleCandidate,
} from "@/types"

const pick = <T,>(items: T[], fallback: T): T => (items.length ? items[0] : fallback)

function baseKeyword(facts: ProductFacts): string {
  const category = facts.category?.trim()
  if (category) return `${category.split(/[>/,]/).pop()?.trim() || category} 추천`
  return `${facts.name.split(" ").slice(0, 2).join(" ")} 추천`
}

export function mockProductAnalysis(facts: ProductFacts): ProductAnalysis {
  const features = facts.features.length ? facts.features : ["상품 상세 정보 확인 필요"]
  return {
    productName: facts.name,
    category: facts.category || "생활용품",
    targetUsers: [
      facts.targetReader || "처음 이 제품군을 구매하려는 사람",
      "비슷한 제품을 비교하며 선택 기준을 찾는 사람",
      "가격 대비 필요한 기능만 갖춘 제품을 찾는 사람",
    ],
    mainBenefits: features.slice(0, 4),
    purchaseMotivations: ["기존 제품 교체", "생활 불편 해소", "선물용 검토"],
    concerns: ["실제 크기와 공간 적합성", "관리·세척 난이도", "가격 대비 구성", "A/S 및 교환 정책"],
    useCases: ["집에서 일상적으로 사용", "작은 공간에서 사용", "가족 구성원과 함께 사용"],
    differentiators: features.slice(0, 2),
  }
}

export function mockKeywordAnalysis(facts: ProductFacts, mainKeywordInput: string | null): KeywordAnalysis {
  const main = mainKeywordInput?.trim() || baseKeyword(facts)
  const root = main.replace(/\s*추천$/, "")
  return {
    mainKeyword: main,
    secondaryKeywords: [`${root} 고르는 법`, `${root} 비교`, `${root} 장단점`, `${root} 가격`],
    longtailKeywords: [
      `${root} 작은 방에 맞는 제품`,
      `${root} 처음 살 때 확인할 점`,
      `${root} 관리 쉬운 제품`,
      `${root} 가성비 선택 기준`,
      `${root} 구매 전 체크리스트`,
    ],
    searchIntent: `${root}을(를) 처음 구매하려는 사용자가 어떤 기준으로 골라야 하는지, 이 상품이 자신에게 맞는지 판단하고 싶어 한다.`,
    searchIntentType: "commercial",
    targetReader: facts.targetReader || `${root} 구매를 고민 중인 20~40대`,
    userQuestions: [
      `${root}은(는) 어떤 기준으로 골라야 하나요?`,
      "관리나 세척은 어렵지 않나요?",
      "작은 공간에서도 쓸 만한가요?",
      "가격대는 어느 정도가 적당한가요?",
      "구매 전 꼭 확인해야 할 점은 무엇인가요?",
    ],
    articleAngles: ["선택 기준 체크리스트", "사용 환경별 적합성", "구매 전 확인사항 정리"],
  }
}

export function mockContentStrategy(
  facts: ProductFacts,
  keywords: KeywordAnalysis,
  sectionCount: number,
  targetChars: number,
  imageCount: number,
): ContentStrategy {
  const root = keywords.mainKeyword.replace(/\s*추천$/, "")
  const plan = [
    { heading: `${root}, 왜 고민하게 될까요`, purpose: "독자의 고민 공감과 검색 의도 확인" },
    { heading: "고르기 전에 확인할 기준", purpose: "선택 기준 체크리스트 제시" },
    { heading: `${facts.name} 살펴보기`, purpose: "입력된 상품 정보를 기준에 맞춰 소개" },
    { heading: "이런 상황에서 활용하기 좋아요", purpose: "사용 상황 예시" },
    { heading: "구매 전 체크할 점", purpose: "고민 포인트와 확인 방법 안내" },
    { heading: "관리와 보관 팁", purpose: "일반적인 관리 방법 정보 제공" },
    { heading: "이런 분께 잘 맞아요", purpose: "적합한 독자 정리" },
  ]
  return {
    primaryAngle: `${root}을(를) 처음 고르는 사람을 위한 선택 기준 정리`,
    targetReader: keywords.targetReader,
    readerProblem: "종류가 많아 어떤 기준으로 골라야 할지 모르겠다",
    articleGoal: "자신에게 필요한 기준을 알고 이 상품이 맞는지 스스로 판단할 수 있게 한다",
    recommendedLength: targetChars,
    recommendedImageCount: imageCount,
    sectionPlan: [...plan.slice(0, Math.max(3, sectionCount - 1)), plan[plan.length - 1]],
  }
}

export function mockTitles(keywords: KeywordAnalysis, count: number): TitleCandidate[] {
  const k = keywords.mainKeyword
  const root = k.replace(/\s*추천$/, "")
  const titles: TitleCandidate[] = [
    { title: `${k}, 처음 고를 때 확인할 5가지`, angle: "체크리스트형", keywordUsage: [k] },
    { title: `${root} 고르는 법, 공간과 용도부터 따져보세요`, angle: "선택 기준형", keywordUsage: [root, `${root} 고르는 법`] },
    { title: `${root} 구매 전 알아두면 좋은 기준 정리`, angle: "구매 가이드형", keywordUsage: [root] },
    { title: `${k} 전에 비교해 볼 장단점과 관리 포인트`, angle: "비교 검토형", keywordUsage: [k, `${root} 장단점`] },
    { title: `작은 방에 맞는 ${root}, 선택 기준 한눈에 보기`, angle: "상황 공감형", keywordUsage: [root] },
    { title: `${root} 가격대별로 무엇이 다를까`, angle: "가격 기준형", keywordUsage: [root, `${root} 가격`] },
  ]
  return titles.slice(0, Math.max(count, 5))
}

export function mockBlogDraft(
  facts: ProductFacts,
  keywords: KeywordAnalysis,
  strategy: ContentStrategy,
  maxLinks: number,
): BlogDraft {
  const root = keywords.mainKeyword.replace(/\s*추천$/, "")
  const feature = pick(facts.features, "상세 페이지에 안내된 구성")
  const productIndex = strategy.sectionPlan.findIndex((s) => s.heading.includes(facts.name))
  const sections = strategy.sectionPlan.map((plan, index) => {
    const isProduct = index === productIndex
    const isLast = index === strategy.sectionPlan.length - 1
    const body = isProduct
      ? `${facts.name}은(는) ${facts.description || "상품 상세 정보에 안내된 제품"}입니다. 상품 정보에 따르면 ${feature} 등이 특징으로 안내되어 있습니다.\n\n앞에서 정리한 기준에 비추어 보면, 사용할 공간과 용도가 명확한 분이라면 한 번 비교해 볼 만한 선택지입니다. 다만 세부 사양은 판매 페이지에서 한 번 더 확인하는 것이 좋습니다.`
      : `${plan.purpose}에 대해 정리해 보겠습니다. ${root}은(는) 사용하는 환경에 따라 만족도가 크게 달라질 수 있어요.\n\n일반적으로는 크기, 관리 난이도, 사용 빈도를 먼저 따져 보는 것이 좋습니다. 이 기준만 정리해 두어도 선택지가 훨씬 줄어듭니다.\n\n- 사용할 공간의 크기\n- 세척·관리 주기\n- 하루 사용 시간`
    return {
      heading: plan.heading,
      body,
      insertAffiliateLink: maxLinks > 0 && (isProduct || (isLast && maxLinks > 1)),
    }
  })
  return {
    intro: `${root}을(를) 알아보다 보면 비슷해 보이는 제품이 많아 어떤 기준으로 골라야 할지 막막해지곤 합니다.\n\n이 글에서는 ${root}을(를) 고를 때 확인하면 좋은 기준을 먼저 정리하고, ${facts.name}의 상품 정보를 그 기준에 맞춰 살펴보겠습니다. 직접 사용한 후기가 아닌, 공개된 상품 정보를 바탕으로 정리한 글입니다.`,
    sections,
    conclusion: `${root}은(는) 사용 환경과 관리 습관에 맞는 제품을 고르는 것이 가장 중요합니다. 오늘 정리한 기준을 바탕으로 필요한 조건을 먼저 적어 보시면 선택이 한결 쉬워질 거예요.\n\n${facts.name}은(는) 위 기준에 해당하는 분이라면 비교 후보로 올려 볼 만하지만, 세부 사양과 판매 조건은 구매 전에 꼭 확인해 보세요.`,
    hashtags: [
      keywords.mainKeyword.replace(/\s/g, ""),
      ...keywords.secondaryKeywords.slice(0, 4).map((k) => k.replace(/\s/g, "")),
      facts.name.replace(/\s/g, ""),
    ],
  }
}

const KIND_ORDER: ImageKind[] = ["hero", "explain", "usage", "summary"]

export function mockImagePlan(
  facts: ProductFacts,
  sections: { index: number; heading: string }[],
  imageCount: number,
): ImagePromptPlan {
  const count = Math.min(imageCount, sections.length)
  const chosen: { index: number; heading: string }[] = []
  for (let i = 0; i < count; i++) {
    const position = count === 1 ? 0 : Math.round((i * (sections.length - 1)) / (count - 1))
    chosen.push(sections[position])
  }
  const scene: Record<ImageKind, string> = {
    hero: "따뜻한 자연광이 들어오는 깔끔한 한국 가정집 거실 테이블 위",
    explain: "밝은 책상 위에 비교하듯 나란히 놓인 비슷한 종류의 생활용품",
    usage: "작은 한국 원룸의 침대 옆 협탁 위, 저녁 무렵 은은한 조명",
    summary: "정돈된 선반 위에 차분하게 놓인 모습, 부드러운 오후 햇살",
  }
  return {
    images: chosen.map((section, i) => {
      const kind = KIND_ORDER[i % KIND_ORDER.length]
      return {
        sectionIndex: section.index,
        kind,
        prompt: `${scene[kind]}, ${facts.category || "생활용품"} 컨셉의 브랜드 없는 제품, 현실적인 블로그 사진 스타일, 과도한 광고 느낌 없음`,
        altText: `${section.heading} 관련 이미지`,
      }
    }),
  }
}

export function mockReview(content: BlogContent): ReviewResult {
  const optimized: BlogContent = {
    ...content,
    sections: content.sections.map((s) => ({ ...s, body: s.body.replace(/정리해 보겠습니다\. /g, "") })),
  }
  return {
    score: 84,
    metrics: {
      searchIntentFit: 88,
      keywordNaturalness: 86,
      titleFit: 90,
      readability: 85,
      productAccuracy: 92,
      adTone: 82,
      ctaAppropriateness: 86,
    },
    issues: [
      {
        type: "repetitive_structure",
        message: "여러 섹션이 '~에 대해 정리해 보겠습니다'로 시작해 문장 구조가 반복됩니다. (Mock 검수 결과)",
        severity: "low",
      },
    ],
    optimizedContent: optimized,
  }
}

export function mockRegeneratedSection(
  section: { heading: string; body: string },
  instruction: string | null,
): RegeneratedSection {
  return {
    heading: section.heading,
    body: `${instruction ? `(요청 반영: ${instruction})\n\n` : ""}${section.body
      .split("\n\n")
      .reverse()
      .join("\n\n")}`,
  }
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!)
}

/** Mock 이미지: 프롬프트 일부를 담은 SVG */
export function createMockImageSvg(prompt: string): string {
  const hue = Array.from(prompt).reduce((acc, ch) => (acc + ch.charCodeAt(0)) % 360, 0)
  const text = escapeXml(prompt.split("\n")[0].slice(0, 60))
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024">
  <rect width="1536" height="1024" fill="hsl(${hue}, 35%, 92%)"/>
  <circle cx="768" cy="460" r="180" fill="hsl(${hue}, 40%, 80%)"/>
  <rect x="648" y="380" width="240" height="200" rx="24" fill="hsl(${hue}, 30%, 65%)"/>
  <text x="768" y="760" font-family="sans-serif" font-size="36" text-anchor="middle" fill="hsl(${hue}, 30%, 30%)">MOCK IMAGE</text>
  <text x="768" y="820" font-family="sans-serif" font-size="26" text-anchor="middle" fill="hsl(${hue}, 20%, 35%)">${text}</text>
</svg>`
}
