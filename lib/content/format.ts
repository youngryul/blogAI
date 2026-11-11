/**
 * 콘텐츠 조립/포맷 유틸 (클라이언트·서버 공용).
 * - 최종 콘텐츠 JSON (STEP 10)
 * - 네이버 블로그 붙여넣기용 plain text / rich text(HTML)
 */
import { DEFAULT_AFFILIATE_LINK_LABEL } from "@/lib/constants"
import type {
  BlogContent,
  ContentBundle,
  ContentRow,
  ContentSectionRow,
  CtaStrength,
  DisclosurePosition,
} from "@/types"

export interface ExportSection {
  id: string
  heading: string
  body: string
  imageUrl: string | null
  imageAlt: string
  cta: { text: string; label: string; url: string } | null
}

/** 최종 콘텐츠 JSON — 미리보기, 복사, 향후 Chrome Extension 에서 공통으로 사용 */
export interface FinalContent {
  id: string
  title: string
  disclosure: string
  disclosurePosition: DisclosurePosition
  intro: string
  sections: ExportSection[]
  conclusion: string
  hashtags: string[]
  affiliateUrl: string | null
  productName: string
  mainKeyword: string | null
  qualityScore: number | null
  updatedAt: string
}

const CTA_TEMPLATES: Record<CtaStrength, { middle: string; last: string }> = {
  weak: {
    middle: "상품 상세 정보는 아래 링크에서 확인할 수 있습니다.",
    last: "더 자세한 상품 정보가 필요하다면 아래 링크를 참고해 주세요.",
  },
  normal: {
    middle: "여기까지 읽고 '나한테 맞겠다' 싶었다면, 지금 가격과 옵션 구성을 아래에서 바로 확인해 보세요.",
    last: "정리한 기준에 맞는다면 고민은 여기까지! 현재 판매 가격과 배송 조건을 아래 링크에서 확인해 보세요.",
  },
  strong: {
    middle: "위 상황에 하나라도 해당된다면, 가격·옵션·배송 조건은 수시로 바뀌니 지금 조건부터 아래에서 확인해 보세요.",
    last: "더 미루면 불편한 날만 길어져요. 지금 적용 중인 가격과 혜택을 아래 링크에서 바로 확인해 보세요.",
  },
}

export function defaultCtaText(strength: CtaStrength, isLast: boolean): string {
  return isLast ? CTA_TEMPLATES[strength].last : CTA_TEMPLATES[strength].middle
}

export function normalizeHashtag(tag: string): string {
  return tag.replace(/^#+/, "").replace(/\s+/g, "").trim()
}

export function formatHashtags(tags: string[]): string {
  return tags
    .map(normalizeHashtag)
    .filter(Boolean)
    .map((t) => `#${t}`)
    .join(" ")
}

/** 본문 문자열을 문단 배열로 분리 (빈 줄 기준) */
export function splitParagraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/** DB 레코드 → BlogContent (AI 검수 입력 등) */
export function toBlogContent(content: ContentRow, sections: ContentSectionRow[]): BlogContent {
  return {
    title: content.title ?? "",
    intro: content.intro ?? "",
    sections: [...sections]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({
        id: s.id,
        heading: s.heading,
        body: s.body,
        imagePrompt: s.image_prompt,
        imageUrl: s.image_url,
        insertAffiliateLink: s.insert_affiliate_link,
      })),
    conclusion: content.conclusion ?? "",
    disclosure: content.disclosure ?? "",
    hashtags: Array.isArray(content.hashtags) ? content.hashtags : [],
  }
}

export function buildFinalContent(bundle: Pick<ContentBundle, "content" | "sections" | "product" | "keywordAnalysis">): FinalContent {
  const { content, product } = bundle
  const sections = [...bundle.sections].sort((a, b) => a.sort_order - b.sort_order)
  const linkIndexes = sections.map((s, i) => (s.insert_affiliate_link ? i : -1)).filter((i) => i >= 0)
  const lastLinkIndex = linkIndexes[linkIndexes.length - 1]
  const affiliateUrl = product.affiliate_url || null

  return {
    id: content.id,
    title: content.title ?? "",
    disclosure: content.disclosure ?? "",
    disclosurePosition: content.disclosure_position,
    intro: content.intro ?? "",
    sections: sections.map((s, i) => ({
      id: s.id,
      heading: s.heading,
      body: s.body,
      imageUrl: s.image_url,
      imageAlt: s.heading,
      cta:
        s.insert_affiliate_link && affiliateUrl
          ? {
              text: s.cta_text || defaultCtaText(content.cta_strength, i === lastLinkIndex && linkIndexes.length > 1),
              label: DEFAULT_AFFILIATE_LINK_LABEL,
              url: affiliateUrl,
            }
          : null,
    })),
    conclusion: content.conclusion ?? "",
    hashtags: (content.hashtags ?? []).map(normalizeHashtag).filter(Boolean),
    affiliateUrl,
    productName: product.name,
    mainKeyword: bundle.keywordAnalysis?.main_keyword ?? content.main_keyword_input,
    qualityScore: content.quality_score,
    updatedAt: content.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------
export interface CopyOptions {
  /** true: HTML 에 <img> 포함 / false: 이미지 위치 표시만 */
  includeImages?: boolean
}

/** 이미지 번호 (이미지가 있는 섹션만 1부터) */
function imageNumbers(final: FinalContent): Map<string, number> {
  const map = new Map<string, number>()
  final.sections.filter((s) => s.imageUrl).forEach((s, i) => map.set(s.id, i + 1))
  return map
}

/** plain text 에는 이미지 자체를 넣을 수 없으므로 항상 위치 표시를 남긴다 */
export function toPlainTextBody(final: FinalContent): string {
  const numbers = imageNumbers(final)
  const blocks: string[] = []
  if (final.disclosure && final.disclosurePosition === "top") blocks.push(final.disclosure)
  if (final.intro) blocks.push(final.intro)

  final.sections.forEach((section) => {
    blocks.push(`■ ${section.heading}`)
    if (section.imageUrl) blocks.push(`[이미지 ${numbers.get(section.id)} 위치]`)
    blocks.push(section.body)
    if (section.cta) blocks.push(`${section.cta.text}\n👉 ${section.cta.label}: ${section.cta.url}`)
  })

  if (final.conclusion) blocks.push(final.conclusion)
  if (final.disclosure && final.disclosurePosition === "bottom") blocks.push(final.disclosure)
  return blocks.join("\n\n")
}

export function toPlainTextAll(final: FinalContent): string {
  const parts = [final.title, toPlainTextBody(final)]
  if (final.hashtags.length) parts.push(formatHashtags(final.hashtags))
  return parts.join("\n\n")
}

// ---------------------------------------------------------------------------
// Rich text (HTML) — 네이버 SmartEditor 붙여넣기용 단순 마크업
// ---------------------------------------------------------------------------
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function paragraphsToHtml(text: string): string {
  return splitParagraphs(text)
    .map((paragraph) => {
      const lines = paragraph.split("\n")
      if (lines.every((l) => /^[-•]\s+/.test(l.trim()))) {
        return `<ul>${lines.map((l) => `<li>${escapeHtml(l.trim().replace(/^[-•]\s+/, ""))}</li>`).join("")}</ul>`
      }
      return `<p>${lines.map(escapeHtml).join("<br>")}</p>`
    })
    .join("\n")
}

export function toHtmlBody(final: FinalContent, options: CopyOptions = {}): string {
  const { includeImages = true } = options
  const numbers = imageNumbers(final)
  const html: string[] = []
  const disclosureHtml = `<p style="color:#666;font-size:13px;">${escapeHtml(final.disclosure)}</p>`
  if (final.disclosure && final.disclosurePosition === "top") html.push(disclosureHtml)
  if (final.intro) html.push(paragraphsToHtml(final.intro))

  final.sections.forEach((section) => {
    html.push(`<h3><b>${escapeHtml(section.heading)}</b></h3>`)
    if (section.imageUrl) {
      html.push(
        includeImages
          ? `<p><img src="${escapeHtml(section.imageUrl)}" alt="${escapeHtml(section.imageAlt)}" style="max-width:100%;"></p>`
          : `<p style="color:#999;">[이미지 ${numbers.get(section.id)} 위치]</p>`,
      )
    }
    html.push(paragraphsToHtml(section.body))
    if (section.cta) {
      html.push(
        `<p>${escapeHtml(section.cta.text)}<br><a href="${escapeHtml(section.cta.url)}" target="_blank" rel="noopener noreferrer sponsored"><b>👉 ${escapeHtml(section.cta.label)}</b></a></p>`,
      )
    }
  })

  if (final.conclusion) html.push(paragraphsToHtml(final.conclusion))
  if (final.disclosure && final.disclosurePosition === "bottom") html.push(disclosureHtml)
  return html.join("\n")
}

export function toHtmlAll(final: FinalContent, options: CopyOptions = {}): string {
  const parts = [`<h2><b>${escapeHtml(final.title)}</b></h2>`, toHtmlBody(final, options)]
  if (final.hashtags.length) parts.push(`<p>${escapeHtml(formatHashtags(final.hashtags))}</p>`)
  return parts.join("\n")
}

// ---------------------------------------------------------------------------
// 블로그 에디터 자동 입력용 블록 — 확장 프로그램이 순서대로 붙여넣는다.
// SmartEditor 는 HTML 속 외부 <img> 를 잘 받지 않으므로 이미지는 별도 블록(파일 업로드)으로 나눈다.
// ---------------------------------------------------------------------------
export type EditorBlock =
  | { type: "html"; html: string; text: string }
  | { type: "image"; url: string; alt: string; fileName: string }

export function toEditorBlocks(final: FinalContent): EditorBlock[] {
  const blocks: EditorBlock[] = []
  let html: string[] = []
  let text: string[] = []
  const flush = () => {
    if (html.length) blocks.push({ type: "html", html: html.join("\n"), text: text.join("\n\n") })
    html = []
    text = []
  }
  const add = (h: string, t: string) => {
    html.push(h)
    text.push(t)
  }

  const disclosureHtml = `<p style="color:#666;font-size:13px;">${escapeHtml(final.disclosure)}</p>`
  if (final.disclosure && final.disclosurePosition === "top") add(disclosureHtml, final.disclosure)
  if (final.intro) add(paragraphsToHtml(final.intro), final.intro)

  let imageIndex = 0
  for (const section of final.sections) {
    add(`<h3><b>${escapeHtml(section.heading)}</b></h3>`, `■ ${section.heading}`)
    if (section.imageUrl) {
      flush()
      imageIndex += 1
      const ext = section.imageUrl.split("?")[0].match(/\.(png|jpe?g|webp|gif)$/i)?.[1] ?? "png"
      blocks.push({ type: "image", url: section.imageUrl, alt: section.imageAlt, fileName: `image-${imageIndex}.${ext}` })
    }
    add(paragraphsToHtml(section.body), section.body)
    if (section.cta) {
      add(
        `<p>${escapeHtml(section.cta.text)}<br><a href="${escapeHtml(section.cta.url)}" target="_blank" rel="noopener noreferrer sponsored"><b>👉 ${escapeHtml(section.cta.label)}</b></a></p>`,
        `${section.cta.text}\n👉 ${section.cta.label}: ${section.cta.url}`,
      )
    }
  }

  if (final.conclusion) add(paragraphsToHtml(final.conclusion), final.conclusion)
  if (final.disclosure && final.disclosurePosition === "bottom") add(disclosureHtml, final.disclosure)
  if (final.hashtags.length) {
    const tags = formatHashtags(final.hashtags)
    add(`<p>${escapeHtml(tags)}</p>`, tags)
  }
  flush()
  return blocks
}

/** 본문 전체 글자 수 (공백 포함) */
export function countBodyChars(content: Pick<BlogContent, "intro" | "sections" | "conclusion">): number {
  return (
    content.intro.length +
    content.sections.reduce((sum, s) => sum + s.heading.length + s.body.length, 0) +
    content.conclusion.length
  )
}
