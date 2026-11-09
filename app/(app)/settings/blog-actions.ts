"use server"

import { revalidatePath } from "next/cache"
import { BLOG_ID_PATTERN, fetchBlogInfo } from "@/lib/naver/blog"
import { createClient } from "@/lib/supabase/server"

export interface BlogLinkState {
  ok: boolean
  message: string | null
}

/** "https://blog.naver.com/abc", "blog.naver.com/abc/223..." , "abc" 모두 허용 */
function extractBlogId(raw: string): string {
  const value = raw.trim()
  const fromUrl = value.match(/blog\.naver\.com\/(?:PostList\.naver\?blogId=)?([A-Za-z0-9_-]+)/)
  return fromUrl?.[1] ?? value.replace(/^@/, "")
}

export async function linkBlog(_prev: BlogLinkState, formData: FormData): Promise<BlogLinkState> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { ok: false, message: "로그인이 필요합니다." }

  const user = data.user
  /**
   * 이 앱 전용 user_settings 테이블에 저장 (profiles 는 다른 서비스와 공유 중이라 건드리지 않음).
   * upsert + select 로 행이 없으면 만들고, 실제로 저장됐는지까지 확인한다.
   */
  async function saveBlogId(naverBlogId: string | null) {
    const { data: saved, error } = await supabase
      .from("user_settings")
      .upsert(
        { user_id: user.id, naver_blog_id: naverBlogId, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      )
      .select("naver_blog_id")
      .maybeSingle()
    if (error) return error.message
    if (!saved) return "설정이 저장되지 않았습니다. (권한 확인 필요)"
    return null
  }

  const raw = String(formData.get("blogId") ?? "")
  if (formData.get("intent") === "disconnect" || !raw.trim()) {
    const saveError = await saveBlogId(null)
    if (saveError) return { ok: false, message: `연결 해제 실패: ${saveError}` }
    revalidatePath("/settings")
    revalidatePath("/dashboard")
    return { ok: true, message: "블로그 연결을 해제했습니다." }
  }

  const blogId = extractBlogId(raw)
  if (!BLOG_ID_PATTERN.test(blogId)) return { ok: false, message: "블로그 ID 형식이 올바르지 않습니다." }

  const blog = await fetchBlogInfo(blogId)
  if (!blog) return { ok: false, message: `'${blogId}' 블로그를 찾을 수 없습니다. ID를 확인해 주세요.` }

  const saveError = await saveBlogId(blogId)
  if (saveError) return { ok: false, message: `저장 실패: ${saveError}` }

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  return { ok: true, message: `'${blog.title}' 블로그를 연결했습니다.` }
}
