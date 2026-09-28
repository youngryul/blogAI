import Link from "next/link"
import { Eye, FileText, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/content/status-badge"
import { formatDate } from "@/lib/format-date"
import type { ContentListItem } from "@/types"

/** 콘텐츠가 어느 화면으로 가야 하는지: 생성 중/초안이면 생성 화면 */
export function contentHref(item: Pick<ContentListItem, "id" | "status">): string {
  return item.status === "draft" || item.status === "generating" ? `/content/${item.id}/generate` : `/content/${item.id}`
}

export function ContentTable({ items }: { items: ContentListItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <FileText className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">아직 만든 콘텐츠가 없습니다.</p>
        <Button asChild size="sm">
          <Link href="/content/new">첫 콘텐츠 만들기</Link>
        </Button>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>상품명</TableHead>
          <TableHead>제목</TableHead>
          <TableHead>메인 키워드</TableHead>
          <TableHead>상태</TableHead>
          <TableHead className="text-right">품질</TableHead>
          <TableHead>생성일</TableHead>
          <TableHead className="text-right">작업</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="max-w-40 truncate font-medium">{item.product?.name ?? "-"}</TableCell>
            <TableCell className="max-w-72 truncate">
              {item.title ?? <span className="text-muted-foreground">(제목 미정)</span>}
            </TableCell>
            <TableCell className="max-w-36 truncate text-muted-foreground">{item.keyword?.main_keyword ?? "-"}</TableCell>
            <TableCell>
              <StatusBadge status={item.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{item.quality_score ?? "-"}</TableCell>
            <TableCell className="text-muted-foreground tabular-nums">{formatDate(item.created_at)}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button asChild variant="ghost" size="sm">
                  <Link href={contentHref(item)}>
                    <Pencil /> 수정
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" disabled={!item.title}>
                  <Link href={`/content/${item.id}/preview`}>
                    <Eye /> 상세보기
                  </Link>
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
