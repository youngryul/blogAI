import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AIAction } from "@/types"

export interface AICallContext {
  supabase: SupabaseClient
  userId: string
  contentId?: string | null
}

export interface UsageRecord {
  action: AIAction
  model: string
  inputTokens?: number
  outputTokens?: number
  imageCount?: number
  estimatedCost?: number
}

/** ai_usage 테이블에 사용량 기록. 실패해도 본 작업을 막지 않는다. */
export async function recordUsage(ctx: AICallContext, record: UsageRecord): Promise<void> {
  const { error } = await ctx.supabase.from("ai_usage").insert({
    user_id: ctx.userId,
    content_id: ctx.contentId ?? null,
    action: record.action,
    model: record.model,
    input_tokens: record.inputTokens ?? 0,
    output_tokens: record.outputTokens ?? 0,
    image_count: record.imageCount ?? 0,
    estimated_cost: Number((record.estimatedCost ?? 0).toFixed(6)),
  })
  if (error) console.warn("[ai_usage] failed to record usage:", error.message)
}
