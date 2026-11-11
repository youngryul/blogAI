import type { TitleCandidate } from "@/types"

/** 손해 회피·이득 약속·호기심을 만드는 표현 */
const CLICK_TRIGGER_PATTERNS = [
  /사기\s*전/,
  /후회\s*없/,
  /꼭\s*(볼|확인|알아)/,
  /놓치/,
  /모르고/,
  /끝내는|해결|달라지/,
  /고르는\s*(법|기준)/,
]

/** 독자 상황을 콕 집는 표현 */
const TARGET_PATTERNS = [/자취|원룸|신혼|아기|육아|직장인|출퇴근|학생|부모님|캠핑|작은\s*(방|집)/]

/**
 * 제목 후보 중 하나를 자동으로 고른다 (사용자 선택 단계 생략용).
 * 네이버 블로그 검색 노출 기준으로 흔히 쓰는 규칙을 점수로 매긴다.
 * - 메인 키워드를 그대로 포함 (+ 앞쪽에 있을수록 가산)
 * - 모바일 검색 결과에서 잘리지 않는 20~35자
 * - 보조 키워드 활용 수 (과하면 키워드 나열처럼 보여 상한)
 * - 클릭률을 높이는 요소(숫자, 손해 회피/이득 약속, 타깃 지목) 가산
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

  // 클릭 유도 요소: 구체적 숫자, 손해 회피/이득 약속, 타깃 지목 (각 1회만 가산)
  if (/\d/.test(title)) score += 8
  if (CLICK_TRIGGER_PATTERNS.some((re) => re.test(title))) score += 8
  if (TARGET_PATTERNS.some((re) => re.test(title))) score += 5

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
