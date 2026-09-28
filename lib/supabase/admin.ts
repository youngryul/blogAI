import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Service Role 클라이언트. RLS 를 우회하므로 서버 내부 작업에서만,
 * 반드시 user_id 를 직접 검증한 뒤 사용한다.
 * 현재는 사용량 집계 등 보조 기능에서만 선택적으로 사용한다.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
