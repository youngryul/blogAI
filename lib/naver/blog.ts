import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * 네이버 블로그 공개 데이터 + 확장 프로그램 수집 지표.
 * - 블로그 정보·게시물: rss.blog.naver.com/{blogId}.xml (공식 RSS, 로그인 불필요)
 * - 방문자 수·애드포스트·커넥트 수익: 크롬 확장 프로그램이 blog_metrics 테이블에 저장한 값
 *   (네이버가 비로그인 방문자 수 조회 주소를 막아서, 로그인된 브라우저에서 수집한다)
 */

export const BLOG_ID_PATTERN = /^[A-Za-z0-9_-]{3,40}$/

const CACHE_SECONDS = 600
const REQUEST_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; ConnectNote/1.0)" }

export type MetricKind = "visitors" | "adpost" | "connect"

export interface DailyValue {
  /** YYYY-MM-DD (KST) */
  date: string
  value: number
}

export interface BlogInfo {
  blogId: string
  title: string
  url: string
  imageUrl: string | null
  /** RSS 에 포함된 게시물 발행 시각 (최신 순, 보통 최근 50개) */
  postDates: Date[]
}

export interface BlogMetricsSummary {
  /** 최근 5일 방문자 (오래된 날 → 최신) */
  visitors: DailyValue[]
  today: number | null
  last5Days: number | null
  adpostYesterday: number | null
  connectYesterday: number | null
  /** 확장 프로그램이 마지막으로 보낸 시각 */
  lastSyncedAt: string | null
}

export interface BlogStats extends BlogMetricsSummary {
  blog: BlogInfo | null
  postsLast7Days: number | null
  fetchedAt: string
}

/** 로그인 사용자가 연결한 네이버 블로그 ID (커넥트노트 전용 user_settings 테이블) */
export async function getLinkedBlogId(supabase: SupabaseClient, userId: string | undefined): Promise<string | null> {
  if (!userId) return null
  const { data } = await supabase.from("user_settings").select("naver_blog_id").eq("user_id", userId).maybeSingle()
  return (data as { naver_blog_id: string | null } | null)?.naver_blog_id ?? null
}

/** KST 기준 YYYY-MM-DD */
export function kstDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date)
}

function cdata(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))\\s*</${tag}>`))
  const value = (match?.[1] ?? match?.[2])?.trim()
  return value || null
}

export function parseBlogRss(xml: string, blogId: string): BlogInfo | null {
  const channel = xml.split("<item>")[0]
  const title = cdata(channel, "title")
  if (!title) return null
  const imageBlock = channel.match(/<image>([\s\S]*?)<\/image>/)?.[1] ?? ""
  const imageUrl = cdata(imageBlock, "url")?.replace(/^http:/, "https:") ?? null

  const postDates = [...xml.matchAll(/<item>[\s\S]*?<pubDate>([^<]+)<\/pubDate>[\s\S]*?<\/item>/g)]
    .map((m) => new Date(m[1].trim()))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())

  return { blogId, title, url: `https://blog.naver.com/${blogId}`, imageUrl, postDates }
}

export async function fetchBlogInfo(blogId: string): Promise<BlogInfo | null> {
  if (!BLOG_ID_PATTERN.test(blogId)) return null
  try {
    const response = await fetch(`https://rss.blog.naver.com/${encodeURIComponent(blogId)}.xml`, {
      headers: REQUEST_HEADERS,
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return null
    return parseBlogRss(await response.text(), blogId)
  } catch {
    return null
  }
}

/** 확장 프로그램이 저장한 지표 요약 (RLS 로 본인 데이터만 조회됨) */
export async function getBlogMetricsSummary(supabase: SupabaseClient, now = new Date()): Promise<BlogMetricsSummary> {
  const day = 24 * 60 * 60 * 1000
  const today = kstDate(now)
  const yesterday = kstDate(new Date(now.getTime() - day))
  const last5 = Array.from({ length: 5 }, (_, i) => kstDate(new Date(now.getTime() - (4 - i) * day)))

  const { data } = await supabase
    .from("blog_metrics")
    .select("metric_date, kind, value, updated_at")
    .gte("metric_date", last5[0])
    .lte("metric_date", today)

  const rows = (data ?? []) as { metric_date: string; kind: MetricKind; value: number | string; updated_at: string }[]
  const find = (kind: MetricKind, date: string) => {
    const row = rows.find((r) => r.kind === kind && r.metric_date === date)
    return row ? Number(row.value) : null
  }

  const hasVisitors = rows.some((r) => r.kind === "visitors")
  const visitors = last5.map((date) => ({ date, value: find("visitors", date) ?? 0 }))
  const lastSyncedAt = rows.reduce<string | null>((max, r) => (!max || r.updated_at > max ? r.updated_at : max), null)

  return {
    visitors: hasVisitors ? visitors : [],
    today: hasVisitors ? (find("visitors", today) ?? 0) : null,
    last5Days: hasVisitors ? visitors.reduce((sum, v) => sum + v.value, 0) : null,
    adpostYesterday: find("adpost", yesterday),
    connectYesterday: find("connect", yesterday),
    lastSyncedAt,
  }
}

export async function getBlogStats(supabase: SupabaseClient, blogId: string, now = new Date()): Promise<BlogStats> {
  const [blog, metrics] = await Promise.all([fetchBlogInfo(blogId), getBlogMetricsSummary(supabase, now)])
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000
  return {
    blog,
    ...metrics,
    postsLast7Days: blog ? blog.postDates.filter((d) => d.getTime() >= weekAgo).length : null,
    fetchedAt: now.toISOString(),
  }
}
