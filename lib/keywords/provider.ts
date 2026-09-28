/**
 * 키워드 데이터 Provider 추상화.
 *
 * MVP: AIKeywordProvider — 검색량 등 정량 데이터 없이 AI 추천만 사용한다.
 * 추후: NaverKeywordProvider — 네이버 검색광고 API(키워드 도구) / 데이터랩(검색어 트렌드, 쇼핑인사이트)
 *       데이터를 붙여 metrics 를 채운다. 파이프라인 코드는 이 인터페이스에만 의존한다.
 */
export interface KeywordMetrics {
  keyword: string
  /** 데이터 출처 (ai | naver ...) */
  source: string
  /** 월간 검색량 (PC + 모바일). 알 수 없으면 null */
  monthlySearchVolume: number | null
  /** 경쟁 정도 */
  competition: "low" | "medium" | "high" | null
  /** 최근 트렌드 방향 */
  trend: "rising" | "stable" | "falling" | null
  /** 연관 키워드 (외부 데이터 기반) */
  relatedKeywords: string[]
  note: string | null
}

export interface KeywordProvider {
  readonly name: string
  analyze(keyword: string): Promise<KeywordMetrics>
}

/** MVP 기본 구현: 정량 데이터 없음을 명시한다 (수치를 지어내지 않음). */
export class AIKeywordProvider implements KeywordProvider {
  readonly name = "ai"

  async analyze(keyword: string): Promise<KeywordMetrics> {
    return {
      keyword,
      source: this.name,
      monthlySearchVolume: null,
      competition: null,
      trend: null,
      relatedKeywords: [],
      note: "AI 추천 기반 키워드입니다. 검색량 데이터는 외부 데이터 연동 후 제공됩니다.",
    }
  }
}

/**
 * 네이버 검색광고 API 연동용 골격.
 * 필요한 환경 변수: NAVER_SEARCHAD_API_KEY, NAVER_SEARCHAD_SECRET, NAVER_SEARCHAD_CUSTOMER_ID
 * (API 서명 생성 및 /keywordstool 호출을 구현하면 된다.)
 */
export class NaverKeywordProvider implements KeywordProvider {
  readonly name = "naver"

  constructor(
    private readonly config: { apiKey: string; secret: string; customerId: string },
  ) {}

  async analyze(keyword: string): Promise<KeywordMetrics> {
    void this.config
    throw new Error(`NaverKeywordProvider 는 아직 구현되지 않았습니다. (keyword: ${keyword})`)
  }
}

export function getKeywordProvider(): KeywordProvider {
  const { NAVER_SEARCHAD_API_KEY, NAVER_SEARCHAD_SECRET, NAVER_SEARCHAD_CUSTOMER_ID, KEYWORD_PROVIDER } =
    process.env
  if (KEYWORD_PROVIDER === "naver" && NAVER_SEARCHAD_API_KEY && NAVER_SEARCHAD_SECRET && NAVER_SEARCHAD_CUSTOMER_ID) {
    return new NaverKeywordProvider({
      apiKey: NAVER_SEARCHAD_API_KEY,
      secret: NAVER_SEARCHAD_SECRET,
      customerId: NAVER_SEARCHAD_CUSTOMER_ID,
    })
  }
  return new AIKeywordProvider()
}
