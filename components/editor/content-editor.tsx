"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Eye, Loader2, Plus, Save, Trash2, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { QualityPanel } from "@/components/content/quality-panel"
import { StatusBadge } from "@/components/content/status-badge"
import { SectionBlock } from "@/components/editor/section-block"
import { toEditorSection, type EditorSection } from "@/components/editor/types"
import { KeywordSummary } from "@/components/keyword/keyword-summary"
import { useContentBundle, useRefreshContent } from "@/hooks/use-content"
import { apiFetch, errorMessage } from "@/lib/api/client"
import { DEFAULT_DISCLOSURE, DISCLOSURE_POSITION_LABELS } from "@/lib/constants"
import { countBodyChars, defaultCtaText, formatHashtags } from "@/lib/content/format"
import { cn } from "@/lib/utils"
import type {
  ContentBundle,
  ContentReviewRow,
  ContentSectionRow,
  DisclosurePosition,
} from "@/types"

interface Draft {
  title: string
  intro: string
  conclusion: string
  disclosure: string
  disclosurePosition: DisclosurePosition
  hashtags: string
  sections: EditorSection[]
}

function toDraft(bundle: ContentBundle): Draft {
  return {
    title: bundle.content.title ?? "",
    intro: bundle.content.intro ?? "",
    conclusion: bundle.content.conclusion ?? "",
    disclosure: bundle.content.disclosure ?? "",
    disclosurePosition: bundle.content.disclosure_position,
    hashtags: formatHashtags(bundle.content.hashtags ?? []),
    sections: bundle.sections.map(toEditorSection),
  }
}

function toPayload(draft: Draft) {
  return {
    title: draft.title.trim(),
    intro: draft.intro,
    conclusion: draft.conclusion,
    disclosure: draft.disclosure,
    disclosurePosition: draft.disclosurePosition,
    hashtags: draft.hashtags.split(/[\s,]+/).filter(Boolean),
    sections: draft.sections.map((s) => ({
      id: s.id,
      heading: s.heading,
      body: s.body,
      imagePrompt: s.imagePrompt,
      imageUrl: s.imageUrl,
      imageKind: s.imageKind,
      insertAffiliateLink: s.insertAffiliateLink,
      ctaText: s.ctaText,
    })),
  }
}

export function ContentEditor({ contentId }: { contentId: string }) {
  const { data: bundle, isLoading, error } = useContentBundle(contentId)

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>콘텐츠를 불러오지 못했습니다</AlertTitle>
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    )
  }
  if (isLoading || !bundle) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-[600px]" />
        <Skeleton className="h-96" />
      </div>
    )
  }
  return <Editor contentId={contentId} bundle={bundle} />
}

function Editor({ contentId, bundle }: { contentId: string; bundle: ContentBundle }) {
  const router = useRouter()
  const { setBundle, refresh } = useRefreshContent(contentId)
  const [draft, setDraft] = useState<Draft>(() => toDraft(bundle))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reviewing, setReviewing] = useState<"evaluate" | "optimize" | null>(null)
  const [confirmOptimize, setConfirmOptimize] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // 저장하지 않은 변경사항 경고
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  const update = useCallback((patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }, [])

  const updateSection = useCallback((key: string, patch: Partial<EditorSection>) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    }))
    setDirty(true)
  }, [])

  /** 저장 후 서버 상태로 draft 재설정 */
  const save = useCallback(
    async (silent = false): Promise<ContentBundle | null> => {
      setSaving(true)
      try {
        const next = await apiFetch<ContentBundle>(`/api/contents/${contentId}`, { method: "PUT", body: toPayload(draft) })
        setBundle(next)
        setDraft(toDraft(next))
        setDirty(false)
        if (!silent) toast.success("저장했습니다.")
        return next
      } catch (e) {
        toast.error(errorMessage(e))
        return null
      } finally {
        setSaving(false)
      }
    },
    [draft, contentId, setBundle],
  )

  /** AI 작업 전 서버에 최신 상태가 있어야 하므로, 변경사항이 있으면 먼저 저장 */
  const ensureSaved = useCallback(async (): Promise<boolean> => {
    if (!dirty) return true
    return (await save(true)) !== null
  }, [dirty, save])

  /** 새로 추가한(아직 id 없는) 섹션에 AI 작업을 하려면 저장이 필요. 저장 후 새 id 로 매핑 */
  const resolveSectionId = useCallback(
    async (section: EditorSection, index: number): Promise<string | null> => {
      if (section.id && !dirty) return section.id
      const saved = await save(true)
      if (!saved) return null
      return saved.sections[index]?.id ?? null
    },
    [dirty, save],
  )

  async function regenerateSection(section: EditorSection, index: number, instruction: string | null) {
    const sectionId = await resolveSectionId(section, index)
    if (!sectionId) return
    setBusy(true)
    try {
      const updated = await apiFetch<ContentSectionRow>("/api/ai/regenerate-section", {
        body: { contentId, sectionId, instruction },
      })
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              sections: prev.sections.map((s) =>
                s.id === sectionId ? { ...s, heading: updated.heading, body: updated.body } : s,
              ),
            }
          : prev,
      )
      await refresh()
      toast.success("섹션을 다시 작성했습니다.")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function generateImage(section: EditorSection, index: number, prompt: string) {
    const sectionId = await resolveSectionId(section, index)
    if (!sectionId) return
    try {
      const result = await apiFetch<{ section: ContentSectionRow | null }>("/api/ai/images", {
        body: { contentId, sectionId, prompt },
      })
      if (result.section) {
        const row = result.section
        setDraft((prev) =>
          prev
            ? {
                ...prev,
                sections: prev.sections.map((s) =>
                  s.id === sectionId ? { ...s, imageUrl: row.image_url, imagePrompt: row.image_prompt } : s,
                ),
              }
            : prev,
        )
      }
      await refresh()
      toast.success("이미지를 생성했습니다.")
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= draft.sections.length) return
    const sections = [...draft.sections]
    ;[sections[index], sections[target]] = [sections[target], sections[index]]
    update({ sections })
  }

  function addSection() {
    update({
      sections: [
        ...draft.sections,
        {
          key: `new-${crypto.randomUUID()}`,
          id: null,
          heading: "새 섹션",
          body: "",
          imagePrompt: null,
          imageUrl: null,
          imageKind: null,
          insertAffiliateLink: false,
          ctaText: null,
        },
      ],
    })
  }

  async function runReview(mode: "evaluate" | "optimize") {
    if (!(await ensureSaved())) return
    setReviewing(mode)
    try {
      await apiFetch<ContentReviewRow>("/api/ai/review", { body: { contentId, mode, trackStep: false } })
      const fresh = await apiFetch<ContentBundle>(`/api/contents/${contentId}`)
      setBundle(fresh)
      if (mode === "optimize") setDraft(toDraft(fresh))
      toast.success(mode === "optimize" ? "검수 결과와 개선안을 적용했습니다." : "검수를 완료했습니다.")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setReviewing(null)
    }
  }

  async function deleteContent() {
    try {
      await apiFetch(`/api/contents/${contentId}`, { method: "DELETE" })
      toast.success("콘텐츠를 삭제했습니다.")
      setDirty(false)
      router.push("/contents")
      router.refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const stats = useMemo(
    () => ({
      chars: countBodyChars({
        intro: draft.intro,
        conclusion: draft.conclusion,
        sections: draft.sections.map((s) => ({ ...s, id: s.id ?? s.key })),
      }),
      links: draft.sections.filter((s) => s.insertAffiliateLink).length,
      images: draft.sections.filter((s) => s.imageUrl).length,
    }),
    [draft],
  )

  const { content, product } = bundle
  const hasAffiliateUrl = Boolean(product.affiliate_url)
  const linkLimitReached = stats.links >= content.max_affiliate_links
  const lastLinkIndex = draft.sections.map((s) => s.insertAffiliateLink).lastIndexOf(true)

  if (bundle.sections.length === 0 && draft.sections.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-muted-foreground">아직 본문이 생성되지 않았습니다.</p>
          <Button asChild>
            <Link href={`/content/${contentId}/generate`}>생성 화면으로 이동</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const disclosureBlock = (
    <div className="rounded-xl border border-dashed bg-muted/30 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">경제적 이해관계 표시 ({DISCLOSURE_POSITION_LABELS[draft.disclosurePosition]})</Label>
        <div className="flex gap-1">
          {(["top", "bottom"] as const).map((pos) => (
            <Button
              key={pos}
              size="xs"
              variant={draft.disclosurePosition === pos ? "secondary" : "ghost"}
              onClick={() => update({ disclosurePosition: pos })}
            >
              {DISCLOSURE_POSITION_LABELS[pos]}
            </Button>
          ))}
          <Button size="xs" variant="ghost" onClick={() => update({ disclosure: DEFAULT_DISCLOSURE })}>
            기본 문구
          </Button>
        </div>
      </div>
      <Textarea
        rows={2}
        value={draft.disclosure}
        onChange={(e) => update({ disclosure: e.target.value })}
        className="bg-card text-sm"
      />
      {!draft.disclosure.trim() && (
        <p className="mt-1.5 text-xs text-red-600">쇼핑 커넥트 글에는 경제적 이해관계 표시가 필요합니다.</p>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* 상단 바 */}
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <StatusBadge status={content.status} />
          <span className="truncate text-sm text-muted-foreground">{product.name}</span>
          {dirty && <span className="text-xs text-amber-600">· 저장되지 않은 변경사항</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} aria-label="삭제">
            <Trash2 />
          </Button>
          <Button asChild variant="outline">
            <Link
              href={`/content/${contentId}/preview`}
              onClick={async (e) => {
                if (dirty) {
                  e.preventDefault()
                  if (await save(true)) router.push(`/content/${contentId}/preview`)
                }
              }}
            >
              <Eye /> 미리보기
            </Link>
          </Button>
          <Button onClick={() => save()} disabled={saving || !dirty}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} 저장
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* 좌측: 에디터 */}
        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">제목</Label>
              {content.title_candidates.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="xs" variant="ghost">
                      <Wand2 /> 제목 후보
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-w-md">
                    <DropdownMenuLabel>AI 제목 후보</DropdownMenuLabel>
                    {content.title_candidates.map((c) => (
                      <DropdownMenuItem key={c.title} onClick={() => update({ title: c.title })}>
                        {c.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <Input
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              className="h-12 text-lg font-semibold"
              placeholder="제목"
            />
          </div>

          {draft.disclosurePosition === "top" && disclosureBlock}

          <div className="rounded-xl border bg-card p-4">
            <Label className="mb-2 block text-xs text-muted-foreground">도입부</Label>
            <Textarea
              value={draft.intro}
              onChange={(e) => update({ intro: e.target.value })}
              className="min-h-28 border-transparent px-2 text-[15px] leading-7 shadow-none hover:border-input"
            />
          </div>

          {draft.sections.map((section, index) => (
            <SectionBlock
              key={section.key}
              section={section}
              index={index}
              total={draft.sections.length}
              busy={busy || saving}
              hasAffiliateUrl={hasAffiliateUrl}
              linkLimitReached={linkLimitReached}
              defaultCta={defaultCtaText(content.cta_strength, index === lastLinkIndex && stats.links > 1)}
              onChange={(patch) => updateSection(section.key, patch)}
              onMove={(direction) => moveSection(index, direction)}
              onDelete={() => update({ sections: draft.sections.filter((s) => s.key !== section.key) })}
              onRegenerate={(instruction) => regenerateSection(section, index, instruction)}
              onGenerateImage={(prompt) => generateImage(section, index, prompt)}
            />
          ))}

          <Button variant="outline" className="w-full border-dashed" onClick={addSection}>
            <Plus /> 섹션 추가
          </Button>

          <div className="rounded-xl border bg-card p-4">
            <Label className="mb-2 block text-xs text-muted-foreground">마무리</Label>
            <Textarea
              value={draft.conclusion}
              onChange={(e) => update({ conclusion: e.target.value })}
              className="min-h-28 border-transparent px-2 text-[15px] leading-7 shadow-none hover:border-input"
            />
          </div>

          {draft.disclosurePosition === "bottom" && disclosureBlock}

          <div className="rounded-xl border bg-card p-4">
            <Label className="mb-2 block text-xs text-muted-foreground">해시태그 (공백으로 구분)</Label>
            <Input value={draft.hashtags} onChange={(e) => update({ hashtags: e.target.value })} />
          </div>
        </div>

        {/* 우측: 분석 패널 */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <QualityPanel
            review={bundle.review}
            reviewing={reviewing}
            onEvaluate={() => runReview("evaluate")}
            onOptimize={() => setConfirmOptimize(true)}
          />

          <Card size="sm">
            <CardHeader>
              <CardTitle>현재 글 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                <Metric label="글자 수" value={stats.chars.toLocaleString("ko-KR")} />
                <Metric
                  label="상품 링크"
                  value={`${stats.links}/${content.max_affiliate_links}`}
                  warn={stats.links > content.max_affiliate_links}
                />
                <Metric label="이미지" value={String(stats.images)} />
              </dl>
            </CardContent>
          </Card>

          {bundle.keywordAnalysis && <KeywordSummary keyword={bundle.keywordAnalysis} compact />}
        </aside>
      </div>

      <Dialog open={confirmOptimize} onOpenChange={setConfirmOptimize}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI 개선안을 적용할까요?</DialogTitle>
            <DialogDescription>
              검수에서 발견된 문제를 고친 버전으로 제목·도입·본문·마무리가 덮어써집니다. 이미지와 광고 표시 문구는 유지됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOptimize(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                setConfirmOptimize(false)
                void runReview("optimize")
              }}
            >
              적용
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>콘텐츠를 삭제할까요?</DialogTitle>
            <DialogDescription>생성된 이미지와 검수 기록도 함께 삭제되며 되돌릴 수 없습니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={deleteContent}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-sm font-semibold tabular-nums", warn && "text-red-600")}>{value}</dd>
    </div>
  )
}
