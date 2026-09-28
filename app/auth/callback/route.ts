import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** 이메일 인증 / OAuth 콜백: code → 세션 교환 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const nextParam = searchParams.get("next") ?? "/dashboard"
  const next = nextParam.startsWith("/") ? nextParam : "/dashboard"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("인증 링크가 만료되었거나 올바르지 않습니다.")}`)
}
