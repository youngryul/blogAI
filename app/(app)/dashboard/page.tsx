import type { Metadata } from "next"
import Link from "next/link"
import { CalendarDays, FilePen, FileText, Plus, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ContentTable } from "@/components/content/content-table"
import { PageHeader } from "@/components/layout/page-header"
import { getDashboardStats, listContents } from "@/lib/data/contents"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const supabase = await createClient()
  const [stats, recent] = await Promise.all([getDashboardStats(supabase), listContents(supabase, { limit: 10 })])

  const cards = [
    { label: "생성한 콘텐츠", value: stats.total, icon: FileText },
    { label: "이번 달 생성", value: stats.thisMonth, icon: CalendarDays },
    { label: "발행 완료", value: stats.published, icon: Send },
    { label: "초안", value: stats.drafts, icon: FilePen },
  ]

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="쇼핑 커넥트 콘텐츠 제작 현황을 확인하세요."
        actions={
          <Button asChild>
            <Link href="/content/new">
              <Plus /> 새 콘텐츠
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>최근 생성 콘텐츠</CardTitle>
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link href="/contents">전체 보기</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ContentTable items={recent.items} />
        </CardContent>
      </Card>
    </>
  )
}
