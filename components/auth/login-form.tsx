"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"

type Mode = "signin" | "signup"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/dashboard"
  const [mode, setMode] = useState<Mode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(searchParams.get("error"))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setNotice(null)
    const supabase = createClient()
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.replace(next.startsWith("/") ? next : "/dashboard")
        router.refresh()
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
        })
        if (error) throw error
        if (data.session) {
          toast.success("가입이 완료되었습니다.")
          router.replace("/dashboard")
          router.refresh()
        } else {
          setNotice("확인 메일을 보냈습니다. 메일의 링크를 누르면 가입이 완료됩니다.")
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "요청에 실패했습니다."
      setNotice(
        message.includes("Invalid login credentials") ? "이메일 또는 비밀번호가 올바르지 않습니다." : message,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="signin" className="flex-1">
              로그인
            </TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">
              회원가입
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {notice && (
            <Alert>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            {mode === "signin" ? "로그인" : "이메일로 가입하기"}
          </Button>
        </form>

        {/* 소셜 로그인은 Supabase Auth provider 설정 후 signInWithOAuth 로 확장 */}
        <Button type="button" variant="outline" className="w-full" size="lg" disabled>
          Google로 계속하기 (준비 중)
        </Button>
      </CardContent>
    </Card>
  )
}
