import type {
  ContentStatus,
  ContentType,
  CtaStrength,
  DisclosurePosition,
  ImageKind,
  LengthOption,
  PipelineStep,
  QualityMetrics,
  ReviewIssueType,
} from "@/types"

export const DEFAULT_DISCLOSURE =
  "이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다."

export const DEFAULT_MAX_AFFILIATE_LINKS = 2
export const DEFAULT_IMAGE_COUNT = 4
export const DEFAULT_AFFILIATE_LINK_LABEL = "상품 확인하기"

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  draft: "초안",
  generating: "생성 중",
  completed: "완료",
  published: "발행 완료",
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  informational: "정보형",
  recommendation: "추천형",
  comparison: "비교형",
  buying_guide: "구매가이드형",
  review: "후기형",
}

export const CONTENT_TYPE_DESCRIPTIONS: Record<ContentType, string> = {
  informational: "상품과 관련된 정보·지식을 중심으로 설명합니다.",
  recommendation: "어떤 사람에게 왜 적합한지 기준을 제시합니다.",
  comparison: "선택 기준별로 장단점과 고려사항을 비교합니다.",
  buying_guide: "구매 전 체크리스트와 선택 방법을 안내합니다.",
  review:
    "실사용 후기가 아닌 '구매 전 검토' 관점으로 작성합니다. 직접 사용한 것처럼 쓰지 않습니다.",
}

export const LENGTH_LABELS: Record<LengthOption, string> = {
  short: "짧게",
  normal: "보통",
  long: "길게",
}

/** 글 길이 옵션별 목표 글자 수(공백 포함, 대략) / 권장 섹션 수 */
export const LENGTH_TARGETS: Record<LengthOption, { chars: number; sections: number }> = {
  short: { chars: 1500, sections: 4 },
  normal: { chars: 2500, sections: 5 },
  long: { chars: 4000, sections: 7 },
}

export const CTA_LABELS: Record<CtaStrength, string> = {
  weak: "약함",
  normal: "보통",
  strong: "강함",
}

export const DISCLOSURE_POSITION_LABELS: Record<DisclosurePosition, string> = {
  top: "글 상단",
  bottom: "글 하단",
}

export const BRAND_TONES = [
  "친근하고 편안한",
  "차분한 정보 전달형",
  "꼼꼼한 전문가형",
  "담백하고 간결한",
] as const

export const IMAGE_KIND_LABELS: Record<ImageKind, string> = {
  hero: "대표 이미지",
  explain: "본문 설명 이미지",
  usage: "사용 상황 이미지",
  summary: "정리 이미지",
}

export const PIPELINE_STEP_LABELS: Record<PipelineStep, string> = {
  product_analysis: "상품 분석",
  keyword_analysis: "키워드·검색 의도 분석",
  content_strategy: "콘텐츠 구조 작성",
  titles: "제목 후보 생성",
  blog: "본문 작성",
  image_prompts: "이미지 프롬프트 생성",
  images: "이미지 생성",
  affiliate_links: "쇼핑 커넥트 링크 배치",
  review: "콘텐츠 검수",
  finalize: "최종 콘텐츠 완성",
}

export const PIPELINE_STEP_PROGRESS_LABELS: Record<PipelineStep, string> = {
  product_analysis: "상품 분석 중",
  keyword_analysis: "키워드 분석 중",
  content_strategy: "콘텐츠 구조 작성 중",
  titles: "제목 후보 생성 중",
  blog: "본문 작성 중",
  image_prompts: "이미지 프롬프트 생성 중",
  images: "이미지 생성 중",
  affiliate_links: "링크·광고 표시 문구 삽입 중",
  review: "콘텐츠 검수 중",
  finalize: "마무리 중",
}

export const QUALITY_METRIC_LABELS: Record<keyof QualityMetrics, string> = {
  searchIntentFit: "검색 의도 적합도",
  keywordNaturalness: "키워드 자연스러움",
  titleFit: "제목 적합도",
  readability: "본문 가독성",
  productAccuracy: "상품 정보 정확성",
  adTone: "광고성 (적절할수록 높음)",
  ctaAppropriateness: "CTA 적절성",
}

export const REVIEW_ISSUE_LABELS: Record<ReviewIssueType, string> = {
  false_information: "허위 정보",
  invented_feature: "없는 기능 생성",
  fake_experience: "허위 사용 경험",
  keyword_stuffing: "키워드 과다 반복",
  unnatural_ai_tone: "부자연스러운 문체",
  repetitive_structure: "문장 구조 반복",
  excessive_advertising: "과도한 광고 표현",
  link_repetition: "링크 반복",
  excessive_cta: "CTA 과다",
  title_intent_mismatch: "제목·검색의도 불일치",
  long_paragraph: "긴 문단",
  missing_disclosure: "경제적 이해관계 표시 누락",
  medical_claim: "의학적 효능 단정",
  other: "기타",
}

export const STORAGE_BUCKETS = {
  contentImages: "content-images",
  productImages: "product-images",
} as const
