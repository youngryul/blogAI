"use client"

import { useState } from "react"
import { Download, ImageIcon, ImagePlus, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { IMAGE_KIND_LABELS } from "@/lib/constants"
import { downloadImage } from "@/lib/download"
import type { EditorSection } from "@/components/editor/types"

export function ImageBlock({
  section,
  index,
  busy,
  onGenerate,
  onChange,
}: {
  section: EditorSection
  index: number
  busy: boolean
  /** 프롬프트로 이미지 (재)생성 */
  onGenerate: (prompt: string) => Promise<void>
  onChange: (patch: Partial<EditorSection>) => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [promptDraft, setPromptDraft] = useState(section.imagePrompt ?? "")
  const [generating, setGenerating] = useState(false)

  async function generate(prompt: string) {
    if (!prompt.trim()) return toast.error("이미지 프롬프트를 입력하세요.")
    setGenerating(true)
    try {
      await onGenerate(prompt.trim())
      setDialogOpen(false)
    } finally {
      setGenerating(false)
    }
  }

  function openPromptDialog() {
    setPromptDraft(section.imagePrompt ?? "")
    setDialogOpen(true)
  }

  const disabled = busy || generating

  return (
    <>
      {section.imageUrl ? (
        <div className="group relative overflow-hidden rounded-lg border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={section.imageUrl} alt={section.heading} className="aspect-[3/2] w-full object-cover" />
          {generating && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent p-2">
            {section.imageKind ? (
              <Badge variant="secondary" className="bg-white/90">
                {IMAGE_KIND_LABELS[section.imageKind]}
              </Badge>
            ) : (
              <span />
            )}
            <div className="flex gap-1">
              <IconAction label="재생성" disabled={disabled} onClick={() => generate(section.imagePrompt ?? "")}>
                <RefreshCw />
              </IconAction>
              <IconAction label="프롬프트 수정" disabled={disabled} onClick={openPromptDialog}>
                <Pencil />
              </IconAction>
              <IconAction
                label="다운로드"
                disabled={disabled}
                onClick={() =>
                  downloadImage(section.imageUrl!, `image-${index + 1}-${section.heading}`).catch((e: Error) =>
                    toast.error(e.message),
                  )
                }
              >
                <Download />
              </IconAction>
              <IconAction label="삭제" disabled={disabled} onClick={() => onChange({ imageUrl: null })}>
                <Trash2 />
              </IconAction>
            </div>
          </div>
        </div>
      ) : section.imagePrompt ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-sm">
          <ImageIcon className="size-5 shrink-0 text-muted-foreground" />
          <p className="line-clamp-2 flex-1 text-muted-foreground">{section.imagePrompt}</p>
          <Button size="sm" variant="outline" disabled={disabled} onClick={openPromptDialog}>
            <Pencil /> 수정
          </Button>
          <Button size="sm" disabled={disabled} onClick={() => generate(section.imagePrompt ?? "")}>
            {generating ? <Loader2 className="animate-spin" /> : <ImagePlus />} 생성
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={disabled} onClick={openPromptDialog}>
          <ImagePlus /> 이미지 추가
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이미지 프롬프트</DialogTitle>
            <DialogDescription>
              특정 브랜드 제품처럼 보이지 않도록 로고·글자 없는 생활 장면 위주로 생성됩니다.
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={5} value={promptDraft} onChange={(e) => setPromptDraft(e.target.value)} />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                onChange({ imagePrompt: promptDraft.trim() || null })
                setDialogOpen(false)
              }}
            >
              프롬프트만 저장
            </Button>
            <Button onClick={() => generate(promptDraft)} disabled={generating}>
              {generating && <Loader2 className="animate-spin" />}
              이 프롬프트로 생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function IconAction({
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
        <Button size="icon-sm" variant="secondary" className="bg-white/90" onClick={onClick} disabled={disabled} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
