import type { TitleCandidate } from "@/types"

/**
 * 제목 후보 중 하나를 자동으로 고른다 (사용자 선택 단계 생략용).
 * 네이버 블로그 검색 노출 기준으로 흔히 쓰는 규칙을 점수로 매긴다.
 * - 메인 키워드를 그대로 포함 (+ 앞쪽에 있을수록 가산)
 * - 모바일 검색 결과에서 잘리지 않는 20~35자
 * - 보조 키워드 활용 수 (과하면 키워드 나열처럼 보여 상한)
 * - 특수문자·느낌표 남발 감점
 */
export function scoreTitle(candidate: TitleCandidate, mainKeyword: string | null | undefined): number {
  const title = candidate.title.trim()
  const keyword = mainKeyword?.trim() ?? ""
  let score = 0

  if (keyword) {
    const index = title.indexOf(keyword)
    if (index >= 0) {
      score += 30
      score += index === 0 ? 10 : index <= 10 ? 5 : 0
    } else if (keyword.split(/\s+/).every((word) => title.includes(word))) {
      score += 15
    }
  }

  const length = [...title].length
  if (length >= 20 && length <= 35) score += 20
  else if (length >= 15 && length <= 40) score += 10
  else score -= 10

  score += Math.min(candidate.keywordUsage.length, 3) * 4

  const symbols = (title.match(/[!?~★☆♥|]/g) ?? []).length
  score -= symbols * 3
  return score
}

export function pickBestTitle(
  candidates: TitleCandidate[],
  mainKeyword: string | null | undefined,
): TitleCandidate | null {
  let best: { candidate: TitleCandidate; score: number } | null = null
  for (const candidate of candidates) {
    if (!candidate.title.trim()) continue
    const score = scoreTitle(candidate, mainKeyword)
    // 동점이면 AI 가 먼저 제시한 후보 유지
    if (!best || score > best.score) best = { candidate, score }
  }
  return best?.candidate ?? null
}
