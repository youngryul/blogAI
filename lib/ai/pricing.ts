/**
 * 대략적인 AI 비용 추정 테이블 (USD).
 * 실제 요금은 OpenAI 요금표(https://openai.com/api/pricing)를 확인해 갱신하세요.
 * 추정치는 사용량 모니터링 용도이며 실제 청구 금액과 다를 수 있습니다.
 */
interface TextModelPrice {
  inputPer1M: number
  outputPer1M: number
}

const TEXT_MODEL_PRICES: Record<string, TextModelPrice> = {
  "gpt-5.5": { inputPer1M: 5, outputPer1M: 30 },
  "gpt-5.4": { inputPer1M: 2.5, outputPer1M: 15 },
  "gpt-5.4-mini": { inputPer1M: 0.75, outputPer1M: 4.5 },
  "gpt-5.4-nano": { inputPer1M: 0.2, outputPer1M: 1.25 },
}
const DEFAULT_TEXT_PRICE: TextModelPrice = { inputPer1M: 1, outputPer1M: 5 }

const IMAGE_PRICE_PER_IMAGE: Record<"low" | "medium" | "high", number> = {
  low: 0.01,
  medium: 0.04,
  high: 0.17,
}

export function estimateTextCost(model: string, inputTokens: number, outputTokens: number): number {
  const key = Object.keys(TEXT_MODEL_PRICES)
    .sort((a, b) => b.length - a.length)
    .find((name) => model.startsWith(name))
  const price = key ? TEXT_MODEL_PRICES[key] : DEFAULT_TEXT_PRICE
  return (inputTokens / 1_000_000) * price.inputPer1M + (outputTokens / 1_000_000) * price.outputPer1M
}

export function estimateImageCost(quality: "low" | "medium" | "high", count = 1): number {
  return IMAGE_PRICE_PER_IMAGE[quality] * count
}
