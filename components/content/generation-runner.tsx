"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, ArrowRight, Check, Circle, Loader2, RefreshCw, SkipForward } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { KeywordSummary } from "@/components/keyword/keyword-summary"
import { useContentBundle, useRefreshContent } from "@/hooks/use-content"
import { apiFetch, errorMessage } from "@/lib/api/client"
import { PIPELINE_STEP_LABELS, PIPELINE_STEP_PROGRESS_LABELS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { PIPELINE_STEPS, type ContentBundle, type PipelineStep, type StepStatus } from "@/types"

/** 제목 선택 전까지 자동 실행되는 단계 */
const PRE_TITLE_STEPS: PipelineStep[] = ["product_analysis", "keyword_analysis", "content_strategy", "titles"]
/** 제목 선택 후 실행되는 단계 */
const POST_TITLE_STEPS: PipelineStep[] = ["blog", "image_prompts", "images", "affiliate_links", "review", "finalize"]

type StatusMap = Record<PipelineStep, StepStatus>

const DONE: StepStatus[] = ["completed", "skipped"]

function initialStatuses(bundle: ContentBundle): StatusMap {
  const map = Object.fromEntries(PIPELINE_STEPS.map((s) => [s, "pending"])) as StatusMap
  for (const row of bundle.steps) {
    // 새로고침 등으로 중단된 processing 은 다시 실행할 수 있게 pending 으로 본다
    map[row.step] = row.status === "processing" ? "pending" : row.status
  }
  return map
}

function initialErrors(bundle: ContentBundle): Partial<Record<PipelineStep, string>> {
  return Object.fromEntries(bundle.steps.filter((s) => s.status === "failed" && s.error).map((s) => [s.step, s.error!]))
}

export function GenerationRunner({ contentId }: { contentId: string }) {
  const { data: bundle, isLoading, error: loadError } = useContentBundle(contentId)

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>콘텐츠를 불러오지 못했습니다</AlertTitle>
        <AlertDescription>{errorMessage(loadError)}</AlertDescription>
      </Alert>
    )
  }
  if (isLoading || !bundle) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  return <Runner contentId={contentId} bundle={bundle} />
}

function Runner({ contentId, bundle }: { contentId: string; bundle: ContentBundle }) {
  const router = useRouter()
  const { refresh } = useRefreshContent(contentId)

  const [statuses, setStatuses] = useState<StatusMap>(() => initialStatuses(bundle))
  const [errors, setErrors] = useState<Partial<Record<PipelineStep, string>>>(() => initialErrors(bundle))
  const [running, setRunning] = useState(false)
  const [imageProgress, setImageProgress] = useState<{ done: number; total: number } | null>(null)
  const [selectedTitle, setSelectedTitle] = useState<string>(
    () => bundle.content.title ?? bundle.content.title_candidates[0]?.title ?? "",
  )
  const autoStarted = useRef(false)

  const setStatus = (step: PipelineStep, status: StepStatus) => setStatuses((prev) => ({ ...prev, [step]: status }))

  /** 단계 하나 실행 */
  const executeStep = useCallback(
    async (step: PipelineStep, title?: string) => {
      const id = contentId
      switch (step) {
        case "product_analysis":
          return apiFetch("/api/ai/product-analysis", { body: { contentId: id } })
        case "keyword_analysis":
          return apiFetch("/api/ai/keyword-analysis", { body: { contentId: id } })
        case "content_strategy":
          return apiFetch("/api/ai/content-strategy", { body: { contentId: id } })
        case "titles":
          return apiFetch("/api/ai/titles", { body: { contentId: id } })
        case "blog":
          return apiFetch("/api/ai/blog", { body: { contentId: id, title } })
        case "image_prompts":
          return apiFetch("/api/ai/image-prompts", { body: { contentId: id } })
        case "images": {
          // 요청당 1장씩, 남은 이미지가 없을 때까지 반복
          let done = 0
          for (let guard = 0; guard < 12; guard++) {
            const result = await apiFetch<{ remaining: number; image: unknown }>("/api/ai/images", {
              body: { contentId: id },
            })
            if (result.image) done++
            setImageProgress({ done, total: done + result.remaining })
            if (result.remaining === 0) break
          }
          setImageProgress(null)
          return
        }
        case "affiliate_links":
          return apiFetch("/api/ai/affiliate-links", { body: { contentId: id } })
        case "review":
          return apiFetch("/api/ai/review", { body: { contentId: id, mode: "optimize" } })
        case "finalize":
          return apiFetch(`/api/contents/${id}/finalize`, { method: "POST" })
      }
    },
    [contentId],
  )

  /** 주어진 단계 목록 중 완료되지 않은 단계를 순서대로 실행. 실패하면 멈춘다. */
  const runSequence = useCallback(
    async (steps: PipelineStep[], current: StatusMap, title?: string): Promise<boolean> => {
      setRunning(true)
      try {
        for (const step of steps) {
          if (DONE.includes(current[step])) continue
          setStatus(step, "processing")
          setErrors((prev) => ({ ...prev, [step]: undefined }))
          try {
            await executeStep(step, title)
            setStatus(step, "completed")
            current = { ...current, [step]: "completed" }
            await refresh()
          } catch (error) {
            setStatus(step, "failed")
            setErrors((prev) => ({ ...prev, [step]: errorMessage(error) }))
            toast.error(`${PIPELINE_STEP_LABELS[step]} 실패: ${errorMessage(error)}`)
            return false
          }
        }
        return true
      } finally {
        setRunning(false)
      }
    },
    [executeStep, refresh],
  )

  const preTitleDone = PRE_TITLE_STEPS.every((s) => DONE.includes(statuses[s]))
  const blogStarted = statuses.blog !== "pending"
  const allDone = PIPELINE_STEPS.every((s) => DONE.includes(statuses[s]))
  const failedStep = PIPELINE_STEPS.find((s) => statuses[s] === "failed")
  const awaitingTitle = preTitleDone && !blogStarted && !running

  // 진입 시 자동 실행: 제목 선택 전 단계 → (제목 확정 후면) 이후 단계
  useEffect(() => {
    if (autoStarted.current || running || failedStep) return
    // StrictMode 이중 실행에서도 한 번만 시작되도록 타이머 콜백 안에서 플래그를 세운다
    const timer = setTimeout(() => {
      if (autoStarted.current) return
      autoStarted.current = true
      if (!preTitleDone) {
        void runSequence(PRE_TITLE_STEPS, statuses)
      } else if (blogStarted && !allDone) {
        void runSequence(POST_TITLE_STEPS, statuses, bundle.content.title ?? undefined)
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [statuses, bundle, running, failedStep, preTitleDone, blogStarted, allDone, runSequence])

  // 완료 시 에디터로 이동
  useEffect(() => {
    if (allDone && autoStarted.current && !running) {
      toast.success("콘텐츠가 완성되었습니다. 에디터에서 검토해 주세요.")
      router.push(`/content/${contentId}`)
    }
  }, [allDone, running, router, contentId])

  async function startBody() {
    const title = selectedTitle.trim()
    if (!title) return toast.error("제목을 선택하거나 입력하세요.")
    autoStarted.current = true
    await runSequence(POST_TITLE_STEPS, statuses, title)
  }

  async function retry(step: PipelineStep) {
    autoStarted.current = true
    const sequence = PRE_TITLE_STEPS.includes(step) ? PRE_TITLE_STEPS : POST_TITLE_STEPS
    const from = sequence.slice(sequence.indexOf(step))
    const next = { ...statuses, [step]: "pending" as StepStatus }
    await runSequence(from, next, selectedTitle || bundle.content.title || undefined)
  }

  async function regenerateTitles() {
    await runSequence(["titles"], { ...statuses, titles: "pending" })
  }

  async function skipImages() {
    try {
      await apiFetch("/api/ai/images", { body: { contentId, skip: true } })
      const next = { ...statuses, images: "skipped" as StepStatus }
      setStatuses(next)
      setErrors((prev) => ({ ...prev, images: undefined }))
      autoStarted.current = true
      await runSequence(POST_TITLE_STEPS, next, bundle.content.title ?? undefined)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const completedCount = useMemo(() => PIPELINE_STEPS.filter((s) => DONE.includes(statuses[s])).length, [statuses])

  const currentStep = PIPELINE_STEPS.find((s) => statuses[s] === "processing")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{bundle.product.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">콘텐츠 생성</h1>
        </div>
        {bundle.sections.length > 0 && (
          <Button asChild variant="outline">
            <Link href={`/content/${contentId}`}>에디터로 이동</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* 단계 목록 */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>진행 단계</CardTitle>
            <CardDescription>
              {completedCount} / {PIPELINE_STEPS.length} 완료
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={(completedCount / PIPELINE_STEPS.length) * 100} />
            <ol className="space-y-1">
              {PIPELINE_STEPS.map((step, index) => {
                const status = statuses[step]
                return (
                  <li key={step}>
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-2 py-2 text-sm",
                        status === "processing" && "bg-primary/5",
                      )}
                    >
                      <StepIcon status={status} />
                      <span
                        className={cn(
                          "flex-1",
                          status === "pending" && "text-muted-foreground",
                          status === "processing" && "font-medium text-primary",
                        )}
                      >
                        {status === "processing" ? PIPELINE_STEP_PROGRESS_LABELS[step] : PIPELINE_STEP_LABELS[step]}
                        {step === "images" && status === "processing" && imageProgress && (
                          <span className="ml-1 tabular-nums">
                            ({imageProgress.done}/{imageProgress.total})
                          </span>
                        )}
                      </span>
                      {status === "skipped" && <Badge variant="outline">건너뜀</Badge>}
                      {status === "failed" && !running && (
                        <Button size="xs" variant="outline" onClick={() => retry(step)}>
                          <RefreshCw /> 재시도
                        </Button>
                      )}
                    </div>
                    {index === 3 && <div className="my-2 border-t border-dashed" />}
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>

        {/* 결과 패널 */}
        <div className="space-y-6">
          {failedStep && errors[failedStep] && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>{PIPELINE_STEP_LABELS[failedStep]} 단계에서 문제가 발생했습니다</AlertTitle>
              <AlertDescription>
                <p>{errors[failedStep]}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => retry(failedStep)} disabled={running}>
                    <RefreshCw /> 이 단계만 다시 실행
                  </Button>
                  {failedStep === "images" && (
                    <Button size="sm" variant="outline" onClick={skipImages} disabled={running}>
                      <SkipForward /> 이미지 없이 계속
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {currentStep && (
            <Card>
              <CardContent className="flex items-center gap-3 py-2">
                <Loader2 className="size-5 animate-spin text-primary" />
                <div>
                  <p className="font-medium">{PIPELINE_STEP_PROGRESS_LABELS[currentStep]}…</p>
                  <p className="text-sm text-muted-foreground">
                    단계마다 결과가 저장되어, 중간에 실패해도 해당 단계부터 다시 진행할 수 있어요.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 제목 선택 */}
          {preTitleDone && bundle.content.title_candidates.length > 0 && (
            <Card className={cn(awaitingTitle && "ring-2 ring-primary/40")}>
              <CardHeader>
                <CardTitle>제목 선택</CardTitle>
                <CardDescription>
                  {blogStarted ? `확정된 제목: ${bundle.content.title ?? selectedTitle}` : "마음에 드는 제목을 고르거나 직접 다듬어 주세요."}
                </CardDescription>
              </CardHeader>
              {!blogStarted && (
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {bundle.content.title_candidates.map((candidate) => (
                      <button
                        key={candidate.title}
                        type="button"
                        onClick={() => setSelectedTitle(candidate.title)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                          selectedTitle === candidate.title ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-1 size-3.5 shrink-0 rounded-full border",
                            selectedTitle === candidate.title && "border-4 border-primary",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{candidate.title}</span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="secondary">{candidate.angle}</Badge>
                            {candidate.keywordUsage.map((k) => (
                              <Badge key={k} variant="outline">
                                {k}
                              </Badge>
                            ))}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">선택한 제목 (직접 수정 가능)</p>
                    <Input value={selectedTitle} onChange={(e) => setSelectedTitle(e.target.value)} maxLength={100} />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button onClick={startBody} disabled={running || !selectedTitle.trim()}>
                      이 제목으로 본문 작성 <ArrowRight />
                    </Button>
                    <Button variant="outline" onClick={regenerateTitles} disabled={running}>
                      <RefreshCw /> 제목 다시 생성
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {bundle.keywordAnalysis && <KeywordSummary keyword={bundle.keywordAnalysis} />}

          {bundle.strategy && (
            <Card>
              <CardHeader>
                <CardTitle>콘텐츠 구조</CardTitle>
                <CardDescription>{bundle.strategy.primary_angle}</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm">
                  {bundle.strategy.section_plan.map((plan, i) => (
                    <li key={`${plan.heading}-${i}`} className="flex gap-3">
                      <span className="w-5 shrink-0 text-muted-foreground tabular-nums">{i + 1}.</span>
                      <span>
                        <span className="font-medium">{plan.heading}</span>
                        <span className="block text-muted-foreground">{plan.purpose}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {bundle.productAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle>상품 분석</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                <AnalysisList title="예상 구매자" items={bundle.productAnalysis.result.targetUsers} />
                <AnalysisList title="구매 동기" items={bundle.productAnalysis.result.purchaseMotivations} />
                <AnalysisList title="구매 시 고민" items={bundle.productAnalysis.result.concerns} />
                <AnalysisList title="활용 상황" items={bundle.productAnalysis.result.useCases} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "completed" || status === "skipped")
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="size-3" />
      </span>
    )
  if (status === "processing") return <Loader2 className="size-5 animate-spin text-primary" />
  if (status === "failed") return <AlertCircle className="size-5 text-destructive" />
  return <Circle className="size-5 text-muted-foreground/40" />
}

function AnalysisList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1.5 font-medium">{title}</p>
      <ul className="space-y-1 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>· {item}</li>
        ))}
      </ul>
    </div>
  )
}
