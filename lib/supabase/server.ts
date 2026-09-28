import "server-only"

import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { getSupabaseEnv } from "@/lib/env"

/** Server Component / Route Handler / Server Action 용 Supabase 클라이언트 (쿠키 세션) */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()
  const { url, anonKey } = getSupabaseEnv()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Component 에서 호출된 경우 무시 (proxy 가 세션을 갱신한다)
        }
      },
    },
  })
}
