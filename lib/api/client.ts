/** 브라우저에서 내부 API 를 호출하는 헬퍼. `{ data }` / `{ error }` 규약을 처리한다. */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = "ApiClientError"
  }
}

export async function apiFetch<T>(
  url: string,
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })

  let json: { data?: T; error?: { message: string; details?: unknown } } | null = null
  try {
    json = await response.json()
  } catch {
    // 빈 응답 또는 HTML 에러 페이지 (예: 서버리스 타임아웃)
  }

  if (!response.ok || !json || json.error) {
    const message =
      json?.error?.message ??
      (response.status === 504 ? "서버 응답 시간이 초과되었습니다. 다시 시도해 주세요." : `요청 실패 (${response.status})`)
    throw new ApiClientError(message, response.status, json?.error?.details)
  }
  return json.data as T
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
}
