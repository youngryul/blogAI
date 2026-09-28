import "server-only"

import { NextResponse } from "next/server"
import { ZodError, type z } from "zod"
import { ApiError, badRequest } from "@/lib/api/errors"

export type ApiSuccess<T> = { data: T }
export type ApiFailure = { error: { message: string; details?: unknown } }

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ data }, init)
}

export function fail(status: number, message: string, details?: unknown): NextResponse<ApiFailure> {
  return NextResponse.json({ error: { message, details } }, { status })
}

/** Route Handler 공통 에러 처리 래퍼 */
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args)
    } catch (error) {
      if (error instanceof ApiError) return fail(error.status, error.message, error.details)
      if (error instanceof ZodError) return fail(400, "요청 값이 올바르지 않습니다.", error.issues)
      console.error("[api] unexpected error", error)
      const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      return fail(500, message)
    }
  }
}

export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    throw badRequest("JSON 본문을 읽을 수 없습니다.")
  }
  return schema.parse(json)
}
