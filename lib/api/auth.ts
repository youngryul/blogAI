import "server-only"

import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js"
import { unauthorized } from "@/lib/api/errors"
import { getSupabaseEnv } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

export interface AuthContext {
  supabase: SupabaseClient
  user: User
}

/**
 * Route Handler 인증.
 * - 웹앱: Supabase 세션 쿠키
 * - 추후 Chrome Extension: `Authorization: Bearer <supabase access token>` 헤더
 * 어느 쪽이든 RLS 가 적용된 사용자 권한의 클라이언트를 반환한다.
 */
export async function requireAuth(request?: Request): Promise<AuthContext> {
  const authHeader = request?.headers.get("authorization")
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim()
    const { url, anonKey } = getSupabaseEnv()
    const supabase = createSupabaseClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) throw unauthorized()
    return { supabase, user: data.user }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw unauthorized()
  return { supabase, user: data.user }
}
