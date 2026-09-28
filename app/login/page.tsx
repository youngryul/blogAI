import type { Metadata } from "next"
import { Suspense } from "react"
import { PenLine } from "lucide-react"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = { title: "로그인" }

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <PenLine className="size-5" />
          </div>
          <h1 className="text-xl font-semibold">커넥트노트</h1>
          <p className="text-sm text-muted-foreground">
            쇼핑 커넥트 상품으로 검색 사용자에게 도움이 되는 블로그 글을 준비하세요.
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}
