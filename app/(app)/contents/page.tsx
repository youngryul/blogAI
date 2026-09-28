import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ContentTable } from "@/components/content/content-table"
import { PageHeader } from "@/components/layout/page-header"
import { CONTENT_STATUS_LABELS } from "@/lib/constants"
import { listContents } from "@/lib/data/contents"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { CONTENT_STATUSES, type ContentStatus } from "@/types"

export const metadata: Metadata = { title: "콘텐츠" }

const PAGE_SIZE = 20

export default async function ContentsPage({ searchParams }: PageProps<"/contents">) {
  const params = await searchParams
  const statusParam = typeof params.status === "string" ? params.status : undefined
  const status = CONTENT_STATUSES.includes(statusParam as ContentStatus) ? (statusParam as ContentStatus) : undefined
  const page = Math.max(1, Number(params.page) || 1)

  const supabase = await createClient()
  const { items, total } = await listContents(supabase, { status, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const filters: { label: string; value?: ContentStatus }[] = [
    { label: "전체" },
    ...CONTENT_STATUSES.map((value) => ({ label: CONTENT_STATUS_LABELS[value], value })),
  ]
  const hrefFor = (next: { status?: string; page?: number }) => {
    const q = new URLSearchParams()
    if (next.status) q.set("status", next.status)
    if (next.page && next.page > 1) q.set("page", String(next.page))
    const s = q.toString()
    return s ? `/contents?${s}` : "/contents"
  }

  return (
    <>
      <PageHeader
        title="콘텐츠"
        description={`총 ${total}개의 콘텐츠`}
        actions={
          <Button asChild>
            <Link href="/content/new">
              <Plus /> 새 콘텐츠
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={hrefFor({ status: f.value })}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              status === f.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent>
          <ContentTable items={items} />
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link href={hrefFor({ status, page: page - 1 })} aria-disabled={page <= 1}>
              이전
            </Link>
          </Button>
          <span className="tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
            <Link href={hrefFor({ status, page: page + 1 })} aria-disabled={page >= totalPages}>
              다음
            </Link>
          </Button>
        </div>
      )}
    </>
  )
}
