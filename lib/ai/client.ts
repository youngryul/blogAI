import "server-only"

import OpenAI, { toFile } from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import type { z } from "zod"
import { ApiError } from "@/lib/api/errors"
import { aiConfig, isAIMockMode } from "@/lib/env"
import { estimateImageCost, estimateTextCost } from "@/lib/ai/pricing"
import { recordUsage, type AICallContext } from "@/lib/ai/usage"
import { createMockImageSvg } from "@/lib/ai/mock"
import type { AIAction } from "@/types"

export type { AICallContext } from "@/lib/ai/usage"

/** 프롬프트 함수가 반환하는 형태: system(instructions) + user(input) */
export interface PromptParts {
  instructions: string
  input: string
}

let openaiClient: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new ApiError(500, "OPENAI_API_KEY 가 설정되지 않았습니다.")
  }
  openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1, timeout: 180_000 })
  return openaiClient
}

type ReasoningEffort = "low" | "medium" | "high"

function reasoningFor(model: string): { effort: ReasoningEffort } | undefined {
  const configured = process.env.OPENAI_REASONING_EFFORT as ReasoningEffort | undefined
  if (configured) return { effort: configured }
  // gpt-5 / o 계열은 reasoning 모델: 속도·비용을 위해 기본 low
  if (/^(gpt-5|o\d)/.test(model)) return { effort: "low" }
  return undefined
}

function isRetryable(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 0
    return status === 408 || status === 409 || status === 429 || status >= 500
  }
  // 스키마 검증 실패, 파싱 실패, 네트워크 오류 등은 재시도
  return true
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) return new ApiError(502, "OpenAI API 키가 유효하지 않습니다.")
    if (error.status === 429) {
      return new ApiError(429, "OpenAI 사용량 한도에 도달했습니다. 잠시 후 다시 시도하세요.")
    }
    return new ApiError(502, `OpenAI 요청 실패: ${error.message}`)
  }
  const message = error instanceof Error ? error.message : String(error)
  return new ApiError(502, `AI 응답 처리 실패: ${message}`)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface GenerateStructuredParams<S extends z.ZodType> {
  ctx: AICallContext
  action: AIAction
  schema: S
  schemaName: string
  prompt: PromptParts
  /** Mock Mode 에서 사용할 결과 */
  mock: () => z.infer<S>
  /** 후처리 검증. 문제가 있으면 메시지를 반환 → 피드백과 함께 재시도 */
  validate?: (value: z.infer<S>) => string | null
  maxRetries?: number
}

/**
 * OpenAI Responses API + Structured Outputs 로 Zod 스키마에 맞는 결과를 생성한다.
 * JSON 문자열 파싱에 의존하지 않고 SDK 의 `responses.parse` + `zodTextFormat` 을 사용한다.
 * 스키마/후처리 검증 실패 시 문제점을 피드백으로 붙여 재시도한다.
 */
export async function generateStructured<S extends z.ZodType>(
  params: GenerateStructuredParams<S>,
): Promise<z.infer<S>> {
  const { ctx, action, schema, schemaName, prompt, mock, validate } = params
  const maxRetries = params.maxRetries ?? aiConfig.maxRetries

  if (isAIMockMode()) {
    await sleep(400 + Math.random() * 600)
    const value = schema.parse(mock()) as z.infer<S>
    await recordUsage(ctx, { action, model: "mock" })
    return value
  }

  const openai = getOpenAI()
  const model = aiConfig.textModel
  let feedback = ""
  let lastError: unknown = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.responses.parse({
        model,
        instructions: prompt.instructions,
        input: prompt.input + feedback,
        reasoning: reasoningFor(model),
        text: { format: zodTextFormat(schema, schemaName) },
      })

      const inputTokens = response.usage?.input_tokens ?? 0
      const outputTokens = response.usage?.output_tokens ?? 0
      await recordUsage(ctx, {
        action,
        model,
        inputTokens,
        outputTokens,
        estimatedCost: estimateTextCost(model, inputTokens, outputTokens),
      })

      if (!response.output_parsed) {
        throw new Error("모델이 구조화된 응답을 반환하지 않았습니다(거절 또는 빈 응답).")
      }

      // SDK 가 이미 파싱했지만, 방어적으로 한 번 더 검증한다.
      const value = schema.parse(response.output_parsed) as z.infer<S>
      const problem = validate?.(value)
      if (problem) {
        feedback = `\n\n[이전 응답의 문제점 - 반드시 수정해서 다시 작성]\n${problem}`
        lastError = new Error(problem)
        continue
      }
      return value
    } catch (error) {
      lastError = error
      if (!isRetryable(error) || attempt === maxRetries) break
      await sleep(800 * (attempt + 1))
    }
  }

  throw toApiError(lastError)
}

export interface GeneratedImage {
  buffer: Buffer
  contentType: string
  extension: string
  model: string
}

export interface ReferenceImage {
  buffer: Buffer
  contentType: string
}

/**
 * 이미지 생성 (Mock Mode 에서는 SVG 플레이스홀더).
 * referenceImage 가 있으면 실제 상품 사진을 참조(images.edit)해 '진짜 그 상품'이 등장하는 실사 컷을 만든다.
 * 참조 생성이 실패하면 일반 생성으로 자동 폴백한다.
 */
export async function generateImage(
  ctx: AICallContext,
  prompt: string,
  options: { referenceImage?: ReferenceImage | null; fallbackPrompt?: string } = {},
): Promise<GeneratedImage> {
  if (options.referenceImage && !isAIMockMode()) {
    try {
      return await generateImageFromReference(ctx, prompt, options.referenceImage)
    } catch (error) {
      console.warn("[image] 상품 참조 이미지 생성 실패 — 일반 생성으로 폴백", error)
    }
    return generateImage(ctx, options.fallbackPrompt ?? prompt)
  }
  return generateImageFromText(ctx, prompt)
}

async function generateImageFromReference(
  ctx: AICallContext,
  prompt: string,
  reference: ReferenceImage,
): Promise<GeneratedImage> {
  const openai = getOpenAI()
  const model = aiConfig.imageModel
  const extension = reference.contentType.includes("png") ? "png" : reference.contentType.includes("webp") ? "webp" : "jpg"
  const result = await openai.images.edit({
    model,
    image: await toFile(reference.buffer, `product.${extension}`, { type: reference.contentType }),
    prompt,
    n: 1,
    size: "1536x1024",
    quality: aiConfig.imageQuality,
    output_format: "jpeg",
  })
  const b64 = result.data?.[0]?.b64_json
  if (!b64) throw new Error("이미지 데이터가 비어 있습니다.")

  await recordUsage(ctx, {
    action: "image_generation",
    model,
    inputTokens: result.usage?.input_tokens ?? 0,
    outputTokens: result.usage?.output_tokens ?? 0,
    imageCount: 1,
    estimatedCost: estimateImageCost(aiConfig.imageQuality),
  })
  return { buffer: Buffer.from(b64, "base64"), contentType: "image/jpeg", extension: "jpg", model }
}

async function generateImageFromText(ctx: AICallContext, prompt: string): Promise<GeneratedImage> {
  if (isAIMockMode()) {
    await sleep(600)
    await recordUsage(ctx, { action: "image_generation", model: "mock", imageCount: 1 })
    return {
      buffer: Buffer.from(createMockImageSvg(prompt), "utf8"),
      contentType: "image/svg+xml",
      extension: "svg",
      model: "mock",
    }
  }

  const openai = getOpenAI()
  const model = aiConfig.imageModel
  let lastError: unknown = null

  for (let attempt = 0; attempt <= aiConfig.maxRetries; attempt++) {
    try {
      const result = await openai.images.generate({
        model,
        prompt,
        n: 1,
        size: "1536x1024",
        quality: aiConfig.imageQuality,
        output_format: "jpeg",
      })
      const b64 = result.data?.[0]?.b64_json
      if (!b64) throw new Error("이미지 데이터가 비어 있습니다.")

      await recordUsage(ctx, {
        action: "image_generation",
        model,
        inputTokens: result.usage?.input_tokens ?? 0,
        outputTokens: result.usage?.output_tokens ?? 0,
        imageCount: 1,
        estimatedCost: estimateImageCost(aiConfig.imageQuality),
      })
      return { buffer: Buffer.from(b64, "base64"), contentType: "image/jpeg", extension: "jpg", model }
    } catch (error) {
      lastError = error
      if (!isRetryable(error) || attempt === aiConfig.maxRetries) break
      await sleep(1000 * (attempt + 1))
    }
  }
  throw toApiError(lastError)
}
