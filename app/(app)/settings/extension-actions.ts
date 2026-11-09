"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export interface ExtensionTokenState {
  ok: boolean
  message: string | null
  /** 새로 발급한 연결 코드 (이때 한 번만 보여줌) */
  token: string | null
}

export async function manageExtensionToken(
  _prev: ExtensionTokenState,
  formData: FormData,
): Promise<ExtensionTokenState> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { ok: false, message: "로그인이 필요합니다.", token: null }

  if (formData.get("intent") === "revoke") {
    const { error } = await supabase.rpc("revoke_extension_token")
    if (error) return { ok: false, message: `해제 실패: ${error.message}`, token: null }
    revalidatePath("/settings")
    return { ok: true, message: "확장 프로그램 연결을 해제했습니다.", token: null }
  }

  const { data: token, error } = await supabase.rpc("create_extension_token")
  if (error || typeof token !== "string") {
    return { ok: false, message: `발급 실패: ${error?.message ?? "알 수 없는 오류"}`, token: null }
  }
  revalidatePath("/settings")
  return { ok: true, message: "새 연결 코드를 만들었습니다. 지금 복사해 확장 프로그램에 붙여넣으세요.", token }
}
