export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export const notFound = (what = "리소스") => new ApiError(404, `${what}를 찾을 수 없습니다.`)
export const badRequest = (message: string, details?: unknown) => new ApiError(400, message, details)
export const unauthorized = () => new ApiError(401, "로그인이 필요합니다.")
