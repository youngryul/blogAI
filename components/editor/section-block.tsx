"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Link2, Loader2, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ImageBlock } from "@/components/editor/image-block"
import type { EditorSection } from "@/components/editor/types"
import { DEFAULT_AFFILIATE_LINK_LABEL } from "@/lib/constants"
import { cn } from "@/lib/utils"

export function SectionBlock({
  section,
  index,
  total,
  busy,
  hasAffiliateUrl,
  defaultCta,
  linkLimitReached,
  onChange,
  onMove,
  onDelete,
  onRegenerate,
  onGenerateImage,
}: {
  section: EditorSection
  index: number
  total: number
  busy: boolean
  hasAffiliateUrl: boolean
  defaultCta: string
  linkLimitReached: boolean
  onChange: (patch: Partial<EditorSection>) => void
  onMove: (direction: -1 | 1) => void
  onDelete: () => void
  onRegenerate: (instruction: string | null) => Promise<void>
  onGenerateImage: (prompt: string) => Promise<void>
}) {
  const [regenOpen, setRegenOpen] = useState(false)
  const [instruction, setInstruction] = useState("")
  const [regenerating, setRegenerating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function regenerate() {
    setRegenerating(true)
    try {
      await onRegenerate(instruction.trim() || null)
      setRegenOpen(false)
      setInstruction("")
    } finally {
      setRegenerating(false)
    }
  }

  const disabled = busy || regenerating

  return (
    <div className={cn("group rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm", regenerating && "opacity-70")}>
      {/* 툴바 */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">섹션 {index + 1}</span>
        <div className="flex items-center gap-0.5">
          <ToolbarButton label="AI 재생성" onClick={() => setRegenOpen(true)} disabled={disabled}>
            {regenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
          </ToolbarButton>
          <ToolbarButton label="위로" onClick={() => onMove(-1)} disabled={disabled || index === 0}>
            <ArrowUp />
          </ToolbarButton>
          <ToolbarButton label="아래로" onClick={() => onMove(1)} disabled={disabled || index === total - 1}>
            <ArrowDown />
          </ToolbarButton>
          <ToolbarButton label="삭제" onClick={() => setConfirmDelete(true)} disabled={disabled}>
            <Trash2 />
          </ToolbarButton>
        </div>
      </div>

      <div className="space-y-3">
        {/* Heading */}
        <Input
          value={section.heading}
          onChange={(e) => onChange({ heading: e.target.value })}
          placeholder="소제목"
          className="h-10 border-transparent px-2 text-base font-semibold shadow-none hover:border-input focus-visible:border-ring"
        />

        {/* Image */}
        <ImageBlock section={section} index={index} busy={disabled} onGenerate={onGenerateImage} onChange={onChange} />

        {/* Body */}
        <Textarea
          value={section.body}
          onChange={(e) => onChange({ body: e.target.value })}
          placeholder="본문 (문단은 빈 줄로 구분)"
          className="min-h-40 resize-y border-transparent px-2 text-[15px] leading-7 shadow-none hover:border-input focus-visible:border-ring"
        />

        {/* CTA */}
        <div
          className={cn(
            "rounded-lg border p-3",
            section.insertAffiliateLink ? "border-primary/30 bg-primary/5" : "border-dashed",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="size-4 text-muted-foreground" />
              섹션 뒤 상품 링크 (CTA)
            </label>
            <Switch
              checked={section.insertAffiliateLink}
              disabled={disabled || !hasAffiliateUrl || (!section.insertAffiliateLink && linkLimitReached)}
              onCheckedChange={(checked) => onChange({ insertAffiliateLink: checked })}
            />
          </div>
          {!hasAffiliateUrl && <p className="mt-1 text-xs text-muted-foreground">쇼핑 커넥트 URL 이 없는 상품입니다.</p>}
          {!section.insertAffiliateLink && linkLimitReached && hasAffiliateUrl && (
            <p className="mt-1 text-xs text-muted-foreground">링크는 글 전체에서 최대 개수에 도달했습니다.</p>
          )}
          {section.insertAffiliateLink && (
            <div className="mt-2 space-y-2">
              <Input
                value={section.ctaText ?? ""}
                placeholder={defaultCta}
                onChange={(e) => onChange({ ctaText: e.target.value || null })}
                className="bg-card"
              />
              <span className="inline-flex rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                👉 {DEFAULT_AFFILIATE_LINK_LABEL}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 재생성 다이얼로그 */}
      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>섹션 AI 재생성</DialogTitle>
            <DialogDescription>이 섹션만 다시 작성합니다. 원하는 방향이 있으면 적어 주세요. (선택)</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="예: 더 짧게, 체크리스트 형식으로, 원룸 사용자 관점으로"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenOpen(false)}>
              취소
            </Button>
            <Button onClick={regenerate} disabled={regenerating}>
              {regenerating && <Loader2 className="animate-spin" />}
              재생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>섹션을 삭제할까요?</DialogTitle>
            <DialogDescription>저장하기 전까지는 되돌릴 수 있도록 편집 내용에만 반영됩니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDelete(false)
                onDelete()
              }}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon-sm" variant="ghost" onClick={onClick} disabled={disabled} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
