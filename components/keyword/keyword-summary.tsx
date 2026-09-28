import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { KeywordAnalysisRow, SearchIntentType } from "@/types"

const INTENT_LABELS: Record<SearchIntentType, string> = {
  informational: "정보 탐색",
  commercial: "구매 전 비교·검토",
  transactional: "구매 직전",
}

export function KeywordSummary({ keyword, compact = false }: { keyword: KeywordAnalysisRow; compact?: boolean }) {
  const metrics = keyword.metrics as { monthlySearchVolume?: number | null; note?: string | null } | null
  return (
    <Card size={compact ? "sm" : "default"}>
      <CardHeader>
        <CardTitle>키워드 분석</CardTitle>
        <CardDescription>{keyword.search_intent}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">메인</span>
          <Badge className="text-sm">{keyword.main_keyword}</Badge>
          {keyword.search_intent_type && <Badge variant="outline">{INTENT_LABELS[keyword.search_intent_type]}</Badge>}
          {metrics?.monthlySearchVolume != null && (
            <Badge variant="secondary">월 검색량 {metrics.monthlySearchVolume.toLocaleString("ko-KR")}</Badge>
          )}
        </div>
        <KeywordGroup title="보조 키워드" items={keyword.secondary_keywords} />
        <KeywordGroup title="롱테일 키워드" items={keyword.longtail_keywords} />
        {!compact && (
          <div>
            <p className="mb-1.5 font-medium">검색 사용자 질문</p>
            <ul className="space-y-1 text-muted-foreground">
              {keyword.user_questions.map((q) => (
                <li key={q}>· {q}</li>
              ))}
            </ul>
          </div>
        )}
        {metrics?.note && <p className="text-xs text-muted-foreground">{metrics.note}</p>}
      </CardContent>
    </Card>
  )
}

function KeywordGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1.5 font-medium">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="font-normal">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  )
}
