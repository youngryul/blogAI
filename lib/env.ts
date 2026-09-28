/**
 * 환경 변수 접근 헬퍼.
 * - Supabase 는 필수(없으면 명확한 에러).
 * - OpenAI 키가 없거나 AI_MOCK_MODE=true 이면 Mock Mode 로 동작한다.
 */
export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      "Supabase 환경 변수가 없습니다. .env.local 에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 를 설정하세요.",
    )
  }
  return { url, anonKey }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function isAIMockMode(): boolean {
  return process.env.AI_MOCK_MODE === "true" || !process.env.OPENAI_API_KEY
}

export const aiConfig = {
  textModel: process.env.OPENAI_TEXT_MODEL || "gpt-5.4-mini",
  imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1-mini",
  imageQuality: (process.env.OPENAI_IMAGE_QUALITY || "medium") as "low" | "medium" | "high",
  maxRetries: 2,
}
