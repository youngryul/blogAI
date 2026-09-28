"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  Hash,
  Heading,
  Link2,
  Loader2,
  Send,
  Text,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { StatusBadge } from "@/components/content/status-badge"
import { useContentBundle, useRefreshContent } from "@/hooks/use-content"
import { apiFetch, errorMessage } from "@/lib/api/client"
import { copyRich, copyText } from "@/lib/clipboard"
import {
  buildFinalContent,
  formatHashtags,
  splitParagraphs,
  toHtmlAll,
  toHtmlBody,
  toPlainTextAll,
  toPlainTextBody,
  type FinalContent,
} from "@/lib/content/format"
import { downloadImage } from "@/lib/download"
import { formatDate } from "@/lib/format-date"

export function ContentPreview({ contentId }: { contentId: string }) {
  const { data: bundle, isLoading, error } = useContentBundle(contentId)
  const { refresh } = useRefreshContent(contentId)
  const [includeImages, setIncludeImages] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [blogUrl, setBlogUrl] = useState("")
  const [publishing, setPublishing] = useState(false)

  const final = useMemo(() => (bundle ? buildFinalContent(bundle) : null), [bundle])

  async function doCopy(key: string, action: () => Promise<void>, label: string) {
    try {
      await action()
      setCopied(key)
      toast.success(`${label}을(를) 복사했습니다.`)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000)
    } catch (e) {
      toast.error(`복사 실패: ${errorMessage(e)}`)
    }
  }

  async function markPublished() {
    setPublishing(true)
    try {
      await apiFetch(`/api/contents/${contentId}/publish`, { body: { blogUrl } })
      await refresh()
      toast.success("발행 완료로 기록했습니다.")
      setBlogUrl("")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPublishing(false)
    }
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>콘텐츠를 불러오지 못했습니다</AlertTitle>
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    )
  }
  if (isLoading || !bundle || !final) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-[700px]" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  const options = { includeImages }
  const images = final.sections.filter((s) => s.imageUrl)

  const copyActions = [
    {
      key: "all",
      label: "전체 복사",
      icon: Copy,
      primary: true,
      run: () => copyRich(toHtmlAll(final, options), toPlainTextAll(final)),
    },
    { key: "title", label: "제목 복사", icon: Heading, run: () => copyText(final.title) },
    {
      key: "body",
      label: "본문 복사",
      icon: Text,
      run: () => copyRich(toHtmlBody(final, options), toPlainTextBody(final)),
    },
    { key: "body-plain", label: "본문 복사 (텍스트만)", icon: Text, run: () => copyText(toPlainTextBody(final)) },
    { key: "hashtags", label: "해시태그 복사", icon: Hash, run: () => copyText(formatHashtags(final.hashtags)) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/content/${contentId}`}>
            <ArrowLeft /> 에디터로
          </Link>
        </Button>
        <StatusBadge status={bundle.content.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* 네이버 블로그 스타일 미리보기 */}
        <div className="flex justify-center rounded-xl bg-muted/40 p-4 sm:p-8">
          <article className="blog-preview w-full max-w-[720px] rounded-md bg-white px-6 py-10 shadow-sm sm:px-12">
            <BlogPreviewBody final={final} createdAt={bundle.content.created_at} />
          </article>
        </div>

        {/* 복사 패널 */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
          <Card>
            <CardHeader>
              <CardTitle>복사하기</CardTitle>
              <CardDescription>네이버 블로그 SmartEditor 에 붙여넣어 직접 게시하세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center justify-between gap-2 text-sm">
                <span>
                  본문에 이미지 포함
                  <span className="block text-xs text-muted-foreground">꺼두고 이미지를 따로 올리는 것을 권장</span>
                </span>
                <Switch checked={includeImages} onCheckedChange={setIncludeImages} />
              </label>
              <Separator />
              {copyActions.map(({ key, label, icon: Icon, run, primary }) => (
                <Button
                  key={key}
                  variant={primary ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => doCopy(key, run, label.replace(" 복사", ""))}
                >
                  {copied === key ? <Check /> : <Icon />}
                  {label}
                </Button>
              ))}
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={!final.affiliateUrl}
                onClick={() => final.affiliateUrl && doCopy("link", () => copyText(final.affiliateUrl!), "쇼핑커넥트 링크")}
              >
                {copied === "link" ? <Check /> : <Link2 />}
                쇼핑커넥트 링크 복사
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>이미지 ({images.length})</CardTitle>
              <CardDescription>다운로드 후 SmartEditor 의 사진 첨부로 올려 주세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {images.length === 0 && <p className="text-sm text-muted-foreground">생성된 이미지가 없습니다.</p>}
              {images.map((section, i) => (
                <div key={section.id} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={section.imageUrl!} alt="" className="size-12 rounded-md border object-cover" />
                  <span className="flex-1 truncate text-sm">
                    {i + 1}. {section.heading}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label="다운로드"
                    onClick={() =>
                      downloadImage(section.imageUrl!, `${i + 1}-${section.heading}`).catch((e: Error) =>
                        toast.error(e.message),
                      )
                    }
                  >
                    <Download />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>발행 기록</CardTitle>
              <CardDescription>게시를 마쳤다면 블로그 주소를 기록해 두세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {bundle.publishedPosts.map((post) => (
                <p key={post.id} className="truncate text-sm">
                  {formatDate(post.published_at)} ·{" "}
                  {post.blog_url ? (
                    <a href={post.blog_url} target="_blank" rel="noreferrer" className="text-primary underline">
                      {post.blog_url}
                    </a>
                  ) : (
                    "주소 없음"
                  )}
                </p>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="blogUrl" className="text-xs">
                  블로그 글 주소 (선택)
                </Label>
                <Input
                  id="blogUrl"
                  value={blogUrl}
                  onChange={(e) => setBlogUrl(e.target.value)}
                  placeholder="https://blog.naver.com/..."
                />
              </div>
              <Button className="w-full" variant="secondary" onClick={markPublished} disabled={publishing}>
                {publishing ? <Loader2 className="animate-spin" /> : <Send />}
                발행 완료로 표시
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {splitParagraphs(text).map((paragraph, i) => {
        const lines = paragraph.split("\n")
        if (lines.every((l) => /^[-•]\s+/.test(l.trim()))) {
          return (
            <ul key={i} className="my-4 list-disc space-y-1 pl-6">
              {lines.map((l, j) => (
                <li key={j}>{l.trim().replace(/^[-•]\s+/, "")}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {paragraph}
          </p>
        )
      })}
    </>
  )
}

function Disclosure({ text }: { text: string }) {
  return <p className="my-6 rounded bg-gray-50 px-4 py-3 text-[13px] leading-relaxed text-gray-500">{text}</p>
}

export function BlogPreviewBody({ final, createdAt }: { final: FinalContent; createdAt: string }) {
  return (
    <>
      <header className="border-b pb-6">
        <p className="mb-2 text-sm text-[#03c75a]">{final.productName}</p>
        <h1 className="text-[26px] font-bold leading-snug text-gray-900">{final.title || "(제목 없음)"}</h1>
        <p className="mt-3 text-sm text-gray-400">{formatDate(createdAt)}</p>
      </header>

      {final.disclosure && final.disclosurePosition === "top" && <Disclosure text={final.disclosure} />}

      <div className="mt-8">
        <Paragraphs text={final.intro} />
      </div>

      {final.sections.map((section) => (
        <section key={section.id} className="mt-12">
          <h2 className="mb-5 border-l-4 border-[#03c75a] pl-3 text-xl font-bold text-gray-900">{section.heading}</h2>
          {section.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={section.imageUrl} alt={section.imageAlt} className="mb-6 w-full rounded" />
          )}
          <Paragraphs text={section.body} />
          {section.cta && (
            <div className="my-8 rounded-lg border border-gray-200 p-5 text-center">
              <p className="mb-3 text-[15px] text-gray-600">{section.cta.text}</p>
              <a
                href={section.cta.url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="inline-block rounded-md bg-[#03c75a] px-6 py-2.5 text-[15px] font-semibold text-white"
              >
                👉 {section.cta.label}
              </a>
            </div>
          )}
        </section>
      ))}

      <div className="mt-12">
        <Paragraphs text={final.conclusion} />
      </div>

      {final.disclosure && final.disclosurePosition === "bottom" && <Disclosure text={final.disclosure} />}

      {final.hashtags.length > 0 && (
        <p className="mt-10 flex flex-wrap gap-x-3 gap-y-1 text-[15px] text-[#1a73e8]">
          {final.hashtags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </p>
      )}
    </>
  )
}
