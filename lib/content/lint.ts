/**
 * 규칙 기반 콘텐츠 사전 점검.
 * AI 검수 전에 확실히 계산 가능한 항목(문단 길이, 키워드 횟수, 링크 수, 금지 표현)을 확인한다.
 * 결과는 AI 검수 프롬프트에 전달되고, AI 가 놓친 항목은 이슈 목록에 병합된다.
 */
import { countBodyChars, splitParagraphs } from "@/lib/content/format"
import type { BlogContent, ReviewIssue } from "@/types"

const FAKE_EXPERIENCE_PATTERNS = [
  /직접\s*(사용|써)\s*(해\s*)?(보니|봤|본\s*결과)/,
  /써\s*보니/,
  /사용해\s*보니/,
  /내돈내산/,
  /(한|두|세)\s*(달|주)\s*(동안|간)\s*(사용|써)/,
  /실사용\s*후기/,
]

const MEDICAL_PATTERNS = [/치료(된|합니다|해\s*줍니다|효과)/, /완치/, /낫(는다|습니다)/, /면역력(이|을)\s*(높|올)/, /효능이\s*입증/]

const HYPE_PATTERNS = [/무조건/, /역대급/, /최저가/, /지금\s*안\s*사면/, /강력\s*추천/, /인생\s*템/, /품절\s*임박/]

function countSentences(paragraph: string): number {
  return paragraph.split(/(?<=[.!?。]|[다요죠]\.)\s+/).filter((s) => s.trim().length > 0).length
}

function countOccurrences(text: string, keyword: string): number {
  if (!keyword.trim()) return 0
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*")
  return (text.match(new RegExp(escaped, "g")) ?? []).length
}

export interface LintResult {
  findings: string[]
  issues: ReviewIssue[]
  stats: {
    totalChars: number
    paragraphCount: number
    longParagraphCount: number
    keywordCount: number
    affiliateLinkCount: number
    hasDisclosure: boolean
  }
}

export function lintContent(
  content: BlogContent,
  options: { mainKeyword: string | null; maxAffiliateLinks: number },
): LintResult {
  const issues: ReviewIssue[] = []
  const allText = [content.title, content.intro, ...content.sections.flatMap((s) => [s.heading, s.body]), content.conclusion].join("\n")

  // 문단 길이
  const paragraphs = [content.intro, ...content.sections.map((s) => s.body), content.conclusion].flatMap(splitParagraphs)
  const longParagraphs = paragraphs.filter((p) => !p.startsWith("-") && (countSentences(p) >= 5 || p.length > 320))
  if (longParagraphs.length > 0) {
    issues.push({
      type: "long_paragraph",
      severity: longParagraphs.length > 2 ? "medium" : "low",
      message: `긴 문단이 ${longParagraphs.length}개 있습니다. 2~4문장 단위로 나누면 모바일에서 읽기 편합니다. (예: "${longParagraphs[0].slice(0, 30)}…")`,
    })
  }

  // 키워드 반복
  const totalChars = countBodyChars(content)
  const keywordCount = options.mainKeyword ? countOccurrences(allText, options.mainKeyword) : 0
  const keywordLimit = Math.max(7, Math.round(totalChars / 350))
  if (options.mainKeyword && keywordCount > keywordLimit) {
    issues.push({
      type: "keyword_stuffing",
      severity: keywordCount > keywordLimit * 1.5 ? "high" : "medium",
      message: `메인 키워드 "${options.mainKeyword}"가 ${keywordCount}회 사용되었습니다. 글 길이 기준 ${keywordLimit}회 이하를 권장합니다.`,
    })
  }

  // 링크 수
  const affiliateLinkCount = content.sections.filter((s) => s.insertAffiliateLink).length
  if (affiliateLinkCount > options.maxAffiliateLinks) {
    issues.push({
      type: "link_repetition",
      severity: "medium",
      message: `상품 링크가 ${affiliateLinkCount}회 배치되어 있습니다. 최대 ${options.maxAffiliateLinks}회를 권장합니다.`,
    })
  }

  // 경제적 이해관계 표시
  const hasDisclosure = content.disclosure.trim().length > 0
  if (!hasDisclosure) {
    issues.push({
      type: "missing_disclosure",
      severity: "high",
      message: "경제적 이해관계(쇼핑 커넥트 수수료) 표시 문구가 없습니다. 반드시 포함해야 합니다.",
    })
  }

  // 금지 표현
  const fake = FAKE_EXPERIENCE_PATTERNS.map((re) => allText.match(re)?.[0]).filter(Boolean)
  if (fake.length) {
    issues.push({
      type: "fake_experience",
      severity: "high",
      message: `실제 사용 경험처럼 보이는 표현이 있습니다: "${fake.join('", "')}"`,
    })
  }
  const medical = MEDICAL_PATTERNS.map((re) => allText.match(re)?.[0]).filter(Boolean)
  if (medical.length) {
    issues.push({
      type: "medical_claim",
      severity: "high",
      message: `의학적 효능을 단정하는 표현이 있습니다: "${medical.join('", "')}"`,
    })
  }
  const hype = HYPE_PATTERNS.map((re) => allText.match(re)?.[0]).filter(Boolean)
  if (hype.length) {
    issues.push({
      type: "excessive_advertising",
      severity: "medium",
      message: `과장된 광고 표현이 있습니다: "${hype.join('", "')}"`,
    })
  }

  const findings = issues.map((i) => `[${i.type}] ${i.message}`)
  findings.unshift(
    `본문 글자 수 ${totalChars}자, 문단 ${paragraphs.length}개, 메인 키워드 ${keywordCount}회, 상품 링크 ${affiliateLinkCount}회, 광고 표시 ${hasDisclosure ? "있음" : "없음"}`,
  )

  return {
    findings,
    issues,
    stats: {
      totalChars,
      paragraphCount: paragraphs.length,
      longParagraphCount: longParagraphs.length,
      keywordCount,
      affiliateLinkCount,
      hasDisclosure,
    },
  }
}

/** AI 이슈와 규칙 기반 이슈 병합 (같은 type 은 AI 결과 우선, 단 규칙 기반 high 는 항상 포함) */
export function mergeIssues(aiIssues: ReviewIssue[], lintIssues: ReviewIssue[]): ReviewIssue[] {
  const types = new Set(aiIssues.map((i) => i.type))
  const extra = lintIssues.filter((i) => !types.has(i.type) || i.severity === "high")
  const order = { high: 0, medium: 1, low: 2 } as const
  return [...aiIssues, ...extra].sort((a, b) => order[a.severity] - order[b.severity])
}
