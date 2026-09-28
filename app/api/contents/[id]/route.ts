import { requireAuth } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/errors"
import { handle, ok, parseBody } from "@/lib/api/http"
import { STORAGE_BUCKETS } from "@/lib/constants"
import { normalizeHashtag } from "@/lib/content/format"
import { getContent, getSections, loadContentBundle } from "@/lib/data/contents"
import { contentUpdateSchema } from "@/lib/validation"
import type { ContentRow } from "@/types"

type Ctx = RouteContext<"/api/contents/[id]">

/** 콘텐츠 상세 (모든 단계 결과 포함) */
export const GET = handle(async (request: Request, context: Ctx) => {
  const { id } = await context.params
  const { supabase } = await requireAuth(request)
  return ok(await loadContentBundle(supabase, id))
})

/** 콘텐츠 수정 (에디터 저장). sections 를 보내면 섹션 목록 전체를 교체한다. */
export const PUT = handle(async (request: Request, context: Ctx) => {
  const { id } = await context.params
  const { supabase, user } = await requireAuth(request)
  await getContent(supabase, id)
  const input = await parseBody(request, contentUpdateSchema)

  const patch: Partial<ContentRow> = {}
  if (input.title !== undefined) patch.title = input.title
  if (input.intro !== undefined) patch.intro = input.intro
  if (input.conclusion !== undefined) patch.conclusion = input.conclusion
  if (input.disclosure !== undefined) patch.disclosure = input.disclosure
  if (input.disclosurePosition) patch.disclosure_position = input.disclosurePosition
  if (input.hashtags) patch.hashtags = Array.from(new Set(input.hashtags.map(normalizeHashtag).filter(Boolean)))
  if (input.status) patch.status = input.status
  if (input.ctaStrength) patch.cta_strength = input.ctaStrength

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("contents").update(patch).eq("id", id)
    if (error) throw new ApiError(500, `콘텐츠 저장 실패: ${error.message}`)
  }

  if (input.sections) {
    const existing = await getSections(supabase, id)
    const existingIds = new Set(existing.map((s) => s.id))
    const keepIds = new Set(
      input.sections.map((s) => s.id).filter((v): v is string => Boolean(v && existingIds.has(v))),
    )

    const removed = existing.filter((s) => !keepIds.has(s.id)).map((s) => s.id)
    if (removed.length) {
      const { error } = await supabase.from("content_sections").delete().in("id", removed)
      if (error) throw new ApiError(500, `섹션 삭제 실패: ${error.message}`)
    }

    const results = await Promise.all(
      input.sections.map((section, index) => {
        const row = {
          sort_order: index,
          heading: section.heading,
          body: section.body,
          image_prompt: section.imagePrompt ?? null,
          image_url: section.imageUrl ?? null,
          image_kind: section.imageKind ?? null,
          insert_affiliate_link: section.insertAffiliateLink,
          cta_text: section.ctaText ?? null,
        }
        if (section.id && existingIds.has(section.id)) {
          return supabase.from("content_sections").update(row).eq("id", section.id)
        }
        return supabase.from("content_sections").insert({ ...row, user_id: user.id, content_id: id })
      }),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) throw new ApiError(500, `섹션 저장 실패: ${failed.error.message}`)
  }

  return ok(await loadContentBundle(supabase, id))
})

/** 콘텐츠 삭제 (생성 이미지 파일 포함) */
export const DELETE = handle(async (request: Request, context: Ctx) => {
  const { id } = await context.params
  const { supabase } = await requireAuth(request)
  await getContent(supabase, id)

  const { data: images } = await supabase.from("content_images").select("storage_path").eq("content_id", id)
  const paths = ((images ?? []) as { storage_path: string | null }[])
    .map((i) => i.storage_path)
    .filter((p): p is string => Boolean(p))
  if (paths.length) {
    const { error } = await supabase.storage.from(STORAGE_BUCKETS.contentImages).remove(paths)
    if (error) console.warn("[contents] failed to remove images:", error.message)
  }

  const { error } = await supabase.from("contents").delete().eq("id", id)
  if (error) throw new ApiError(500, `콘텐츠 삭제 실패: ${error.message}`)
  return ok({ id })
})
