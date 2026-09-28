"use client"

import { useState } from "react"
import { ChevronDown, Loader2, ShieldCheck, Wand2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { QUALITY_METRIC_LABELS, REVIEW_ISSUE_LABELS } from "@/lib/constants"
import { formatDateTime } from "@/lib/format-date"
import { cn } from "@/lib/utils"
import type { ContentReviewRow, QualityMetrics, ReviewIssue } from "@/types"

const SEVERITY_STYLES = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-muted text-muted-foreground",
} as const
const SEVERITY_LABELS = { high: "높음", medium: "보통", low: "낮음" } as const

function scoreColor(score: number): string {
  if (score >= 85) return "text-primary"
  if (score >= 70) return "text-amber-600"
  return "text-red-600"
}

function barColor(score: number): string {
  if (score >= 85) return "bg-primary"
  if (score >= 70) return "bg-amber-500"
  return "bg-red-500"
}

export function QualityPanel({
  review,
  reviewing,
  onEvaluate,
  onOptimize,
}: {
  review: ContentReviewRow | null
  reviewing: "evaluate" | "optimize" | null
  onEvaluate: () => void
  onOptimize: () => void
}) {
  const [showFixed, setShowFixed] = useState(false)
  const metrics = review?.metrics
  const fixed = metrics?.fixedIssues ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" /> 콘텐츠 품질 점수
        </CardTitle>
        <CardDescription>
          {review ? `마지막 검수 ${formatDateTime(review.created_at)}` : "아직 검수하지 않았습니다."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {review && (
          <>
            <div className="flex items-baseline gap-1">
              <span className={cn("text-4xl font-semibold tabular-nums", scoreColor(review.score))}>{review.score}</span>
              <span className="text-muted-foreground">/ 100</span>
            </div>

            <div className="space-y-2.5">
              {(Object.keys(QUALITY_METRIC_LABELS) as (keyof QualityMetrics)[]).map((key) => {
                const value = metrics?.[key]
                if (typeof value !== "number") return null
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{QUALITY_METRIC_LABELS[key]}</span>
                      <span className="font-medium tabular-nums">{value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", barColor(value))} style={{ width: `${value}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {metrics?.stats && (
              <dl className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-xs">
                <Stat label="본문 글자 수" value={`${metrics.stats.totalChars.toLocaleString("ko-KR")}자`} />
                <Stat label="메인 키워드" value={`${metrics.stats.keywordCount}회`} />
                <Stat label="상품 링크" value={`${metrics.stats.affiliateLinkCount}회`} />
                <Stat label="광고 표시" value={metrics.stats.hasDisclosure ? "있음" : "없음"} />
              </dl>
            )}

            <IssueList title="확인이 필요한 항목" issues={review.issues} empty="남은 문제가 없습니다." />

            {fixed.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowFixed((v) => !v)}
                  className="flex w-full items-center justify-between text-sm font-medium"
                >
                  AI 검수에서 자동 수정한 항목 ({fixed.length})
                  <ChevronDown className={cn("size-4 transition-transform", showFixed && "rotate-180")} />
                </button>
                {showFixed && <IssueList issues={fixed} className="mt-2 opacity-80" />}
              </div>
            )}
          </>
        )}

        <div className="grid gap-2">
          <Button variant="outline" onClick={onEvaluate} disabled={reviewing !== null}>
            {reviewing === "evaluate" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            현재 글 재검수
          </Button>
          <Button variant="ghost" onClick={onOptimize} disabled={reviewing !== null}>
            {reviewing === "optimize" ? <Loader2 className="animate-spin" /> : <Wand2 />}
            검수 + AI 개선안 적용
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function IssueList({
  title,
  issues,
  empty,
  className,
}: {
  title?: string
  issues: ReviewIssue[]
  empty?: string
  className?: string
}) {
  return (
    <div className={className}>
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      {issues.length === 0 ? (
        empty && <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {issues.map((issue, i) => (
            <li key={`${issue.type}-${i}`} className="rounded-lg border p-2.5 text-sm">
              <div className="mb-1 flex items-center gap-1.5">
                <Badge variant="secondary" className={SEVERITY_STYLES[issue.severity]}>
                  {SEVERITY_LABELS[issue.severity]}
                </Badge>
                <span className="text-xs font-medium">{REVIEW_ISSUE_LABELS[issue.type] ?? issue.type}</span>
              </div>
              <p className="leading-relaxed text-muted-foreground">{issue.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
