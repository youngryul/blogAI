import Link from "next/link"
import { ExternalLink, PenLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getBlogStats, type DailyValue } from "@/lib/naver/blog"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

const won = (value: number) => `${Math.round(value).toLocaleString("ko-KR")}원`

/** Dashboard 상단 블로그 현황 카드 (서버 컴포넌트) */
export async function BlogStatsCard({ blogId }: { blogId: string | null }) {
  if (!blogId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start justify-between gap-3 py-2 sm:flex-row sm:items-center">
          <div>
            <p className="font-medium">네이버 블로그를 연결하세요</p>
            <p className="text-sm text-muted-foreground">블로그 ID를 입력하면 블로그 정보와 최근 게시물 수를 보여드려요.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/settings#blog">블로그 연결하기</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const supabase = await createClient()
  const stats = await getBlogStats(supabase, blogId)
  const blog = stats.blog
  const noVisitors = stats.today === null
  const noRevenue = stats.adpostYesterday === null && stats.connectYesterday === null

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-3 px-5 py-4">
        {blog?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={blog.imageUrl} alt="" className="size-12 rounded-full border object-cover" />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <PenLine className="size-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-lg font-semibold">{blog?.title ?? blogId}</p>
            <Button asChild variant="outline" size="xs">
              <a href={`https://blog.naver.com/${blogId}`} target="_blank" rel="noreferrer">
                블로그 <ExternalLink />
              </a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {blogId}{" "}
            {blog ? (
              <span className="text-primary">● 연결됨</span>
            ) : (
              <span className="text-amber-600">● 블로그 정보를 불러오지 못했어요</span>
            )}
            {stats.lastSyncedAt && (
              <span className="ml-2 text-xs">
                · 확장 프로그램 동기화{" "}
                {new Date(stats.lastSyncedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" })}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t sm:grid-cols-5">
        <Stat label="TODAY" display={stats.today?.toLocaleString("ko-KR")} />
        <Stat label="최근 5일 방문자" display={stats.last5Days?.toLocaleString("ko-KR")} bars={stats.visitors} />
        <Stat label="최근 7일 게시물" display={stats.postsLast7Days?.toLocaleString("ko-KR")} />
        <Stat label="어제 애드포스트" display={stats.adpostYesterday !== null ? won(stats.adpostYesterday) : undefined} />
        <Stat label="어제 커넥트" display={stats.connectYesterday !== null ? won(stats.connectYesterday) : undefined} />
      </div>

      {(noVisitors || noRevenue) && (
        <p className="border-t px-5 py-2 text-xs text-muted-foreground">
          방문자 수와 수익은 <Link href="/settings#extension" className="underline">크롬 확장 프로그램</Link>을 연결한 뒤,
          네이버에 로그인한 상태로 블로그 통계·애드포스트·브랜드 커넥트 화면을 한 번 열면 채워져요.
        </p>
      )}
    </Card>
  )
}

function Stat({ label, display, bars }: { label: string; display: string | undefined; bars?: DailyValue[] }) {
  const max = bars?.length ? Math.max(1, ...bars.map((b) => b.value)) : 1
  return (
    <div className="space-y-1 border-b px-5 py-4 sm:border-r sm:border-b-0 sm:last:border-r-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className={cn("text-2xl font-semibold tabular-nums", display === undefined && "text-muted-foreground")}>
          {display ?? "-"}
        </p>
        {bars && bars.length > 1 && (
          <div className="flex h-8 items-end gap-0.5" aria-hidden>
            {bars.map((b) => (
              <span
                key={b.date}
                title={`${b.date}: ${b.value}`}
                className="w-1.5 rounded-sm bg-primary/60"
                style={{ height: `${Math.max(8, (b.value / max) * 100)}%` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
