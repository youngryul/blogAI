"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { Check, ExternalLink, Link2, Loader2, PenLine, RefreshCw, Search, ShoppingBag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDateTime } from "@/lib/format-date"
import { cn } from "@/lib/utils"
import type { ConnectProductRow, ConnectProductSource } from "@/types"

export const BRANDCONNECT_HOME = "https://brandconnect.naver.com/"

type Tab = ConnectProductSource | "all"
type Sort = "rank" | "commission" | "recent"

const TAB_LABELS: Record<Tab, string> = {
  popular: "인기 순위",
  recommended: "추천",
  search: "검색한 상품",
  all: "전체",
}

const SORT_LABELS: Record<Sort, string> = { rank: "순위순", commission: "수수료순", recent: "최근 본 순" }

function sortProducts(list: ConnectProductRow[], sort: Sort) {
  const byRecent = (a: ConnectProductRow, b: ConnectProductRow) => b.seen_at.localeCompare(a.seen_at)
  return [...list].sort((a, b) => {
    if (sort === "commission") return (b.commission_rate ?? -1) - (a.commission_rate ?? -1) || byRecent(a, b)
    if (sort === "rank") return (a.rank ?? Infinity) - (b.rank ?? Infinity) || byRecent(a, b)
    return byRecent(a, b)
  })
}

function formatPrice(price: number | null) {
  return price != null ? `${price.toLocaleString("ko-KR")}원` : null
}

export function ConnectProductPicker({
  products = [],
  selectedId,
  writtenUrls,
  onPick,
}: {
  products?: ConnectProductRow[]
  selectedId: string | null
  /** 이미 상품으로 등록된(글을 쓴 적 있는) 상품 URL */
  writtenUrls: Set<string>
  onPick: (product: ConnectProductRow) => void
}) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { popular: 0, recommended: 0, search: 0, all: products.length }
    for (const p of products) c[p.source] += 1
    return c
  }, [products])
  const [tab, setTab] = useState<Tab>(counts.popular ? "popular" : counts.recommended ? "recommended" : "all")
  const [sort, setSort] = useState<Sort>("rank")
  const [query, setQuery] = useState("")

  const lastSeenAt = useMemo(
    () => products.reduce<string | null>((max, p) => (!max || p.seen_at > max ? p.seen_at : max), null),
    [products],
  )

  // 순위는 인기 순위 탭에만 의미가 있으므로 다른 탭에서는 최근 본 순으로 보여준다
  const effectiveSort: Sort = tab !== "popular" && sort === "rank" ? "recent" : sort

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = products.filter(
      (p) =>
        (tab === "all" || p.source === tab) &&
        (!q || [p.name, p.store_name, p.category].some((v) => v?.toLowerCase().includes(q))),
    )
    return sortProducts(filtered, effectiveSort)
  }, [products, tab, effectiveSort, query])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="size-4" />
          브랜드 커넥트에서 고르기
        </CardTitle>
        <CardDescription>
          확장 프로그램을 켜고 브랜드 커넥트의 쇼핑 커넥트 상품 화면(인기·추천·검색)을 열면 여기에 상품이 쌓입니다. 이후에는
          확장 프로그램이 하루 1번 자동으로 갱신해요.
          {lastSeenAt && (
            <span className="mt-1 block text-xs" suppressHydrationWarning>
              최근 수집 {formatDateTime(lastSeenAt)}
            </span>
          )}
        </CardDescription>
        <CardAction className="flex gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={BRANDCONNECT_HOME} target="_blank" rel="noreferrer">
              <ExternalLink />
              브랜드 커넥트
            </a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => startRefresh(() => router.refresh())}
            disabled={refreshing}
            aria-label="목록 새로고침"
          >
            {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <p>아직 수집된 브랜드 커넥트 상품이 없어요.</p>
            <p className="mt-1">
              크롬 확장 프로그램을 연결한 뒤 브랜드 커넥트 → 쇼핑 커넥트 → 상품 찾기 화면을 열고, 위 새로고침을 눌러 주세요.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
                <TabsList>
                  {(["popular", "recommended", "search", "all"] as const).map((t) => (
                    <TabsTrigger key={t} value={t} disabled={t !== "all" && counts[t] === 0}>
                      {TAB_LABELS[t]} <span className="text-xs text-muted-foreground">{counts[t]}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="ml-auto flex gap-1">
                {(["rank", "commission", "recent"] as const)
                  .filter((s) => s !== "rank" || tab === "popular")
                  .map((s) => (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant={effectiveSort === s ? "secondary" : "ghost"}
                      onClick={() => setSort(s)}
                    >
                      {SORT_LABELS[s]}
                    </Button>
                  ))}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="상품명·스토어·카테고리 검색"
                className="pl-8"
              />
            </div>
            <ul className="grid max-h-[420px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {visible.map((p) => {
                const selected = p.id === selectedId
                const written = p.product_url ? writtenUrls.has(p.product_url) : false
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onPick(p)}
                      className={cn(
                        "flex w-full gap-3 rounded-lg border p-2.5 text-left transition-colors hover:bg-muted/50",
                        selected && "border-primary bg-primary/5",
                      )}
                    >
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-md border bg-muted">
                        {p.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image_url} alt="" className="size-full object-cover" loading="lazy" />
                        )}
                        {p.source === "popular" && p.rank != null && (
                          <span className="absolute left-0 top-0 rounded-br-md bg-foreground px-1.5 text-xs font-semibold text-background">
                            {p.rank}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[formatPrice(p.price), p.store_name].filter(Boolean).join(" · ")}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {p.commission_rate != null && <Badge variant="secondary">수수료 {p.commission_rate}%</Badge>}
                          {p.affiliate_url && (
                            <Badge variant="outline">
                              <Link2 />
                              링크 발급됨
                            </Badge>
                          )}
                          {written && (
                            <Badge variant="outline">
                              <PenLine />
                              등록한 상품
                            </Badge>
                          )}
                        </div>
                      </div>
                      {selected && <Check className="size-4 shrink-0 text-primary" />}
                    </button>
                  </li>
                )
              })}
              {visible.length === 0 && (
                <li className="col-span-full py-6 text-center text-sm text-muted-foreground">조건에 맞는 상품이 없어요.</li>
              )}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
