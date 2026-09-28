import type { ContentSectionRow, ImageKind } from "@/types"

/** 에디터에서 편집 중인 섹션 (새 섹션은 id 가 없음) */
export interface EditorSection {
  key: string
  id: string | null
  heading: string
  body: string
  imagePrompt: string | null
  imageUrl: string | null
  imageKind: ImageKind | null
  insertAffiliateLink: boolean
  ctaText: string | null
}

export function toEditorSection(row: ContentSectionRow): EditorSection {
  return {
    key: row.id,
    id: row.id,
    heading: row.heading,
    body: row.body,
    imagePrompt: row.image_prompt,
    imageUrl: row.image_url,
    imageKind: row.image_kind,
    insertAffiliateLink: row.insert_affiliate_link,
    ctaText: row.cta_text,
  }
}
