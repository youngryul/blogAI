"use client"

import { useActionState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { linkBlog, type BlogLinkState } from "@/app/(app)/settings/blog-actions"
import { cn } from "@/lib/utils"

export function BlogLinkForm({ currentBlogId }: { currentBlogId: string | null }) {
  const [state, action, pending] = useActionState<BlogLinkState, FormData>(linkBlog, { ok: true, message: null })

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="blogId">네이버 블로그 ID 또는 주소</Label>
        <Input
          id="blogId"
          name="blogId"
          defaultValue={currentBlogId ?? ""}
          placeholder="예: myblog 또는 https://blog.naver.com/myblog"
        />
        <p className="text-xs text-muted-foreground">
          블로그 ID만 저장합니다. 네이버 비밀번호나 로그인 정보는 저장하지 않아요.
        </p>
      </div>
      {state.message && (
        <p className={cn("text-sm", state.ok ? "text-primary" : "text-red-600")}>{state.message}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" name="intent" value="link" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {currentBlogId ? "변경" : "연결"}
        </Button>
        {currentBlogId && (
          <Button type="submit" name="intent" value="disconnect" variant="ghost" disabled={pending}>
            연결 해제
          </Button>
        )}
      </div>
    </form>
  )
}
