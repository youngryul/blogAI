"use client"

import { useCallback, useEffect, useState } from "react"
import type { EditorBlock } from "@/lib/content/format"

/**
 * 커넥트노트 크롬 확장 프로그램(app-bridge.js)과 window.postMessage 로 대화한다.
 * 확장 프로그램이 있으면 "ready" 신호가 오고, 링크 자동 발급·블로그 자동 작성을 요청할 수 있다.
 */
export interface ExtensionResult {
  ok: boolean
  message?: string | null
  reason?: string
}

export interface IssueLinkResult extends ExtensionResult {
  affiliateUrl?: string | null
}

export interface WritePostResult extends ExtensionResult {
  images?: number
  expectedImages?: number
}

/** 확장 프로그램으로 보내는 블록: 이미지는 data URL 로 바꿔 보낸다 (확장 프로그램이 이미지 주소에 접근할 권한이 없어도 되게) */
export type WritePostBlock =
  | Extract<EditorBlock, { type: "html" }>
  | { type: "image"; dataUrl: string; fileName: string; alt: string }

export interface WritePostPayload {
  contentId: string
  blogId: string | null
  title: string
  blocks: WritePostBlock[]
}

const TIMEOUTS = { "issue-link": 90_000, "write-post": 5 * 60_000 } as const

interface ExtensionMessage {
  __connectnote_ext?: boolean
  type?: string
  version?: string
  requestId?: string
  result?: ExtensionResult
}

function request<T extends ExtensionResult>(type: keyof typeof TIMEOUTS, body: Record<string, unknown>): Promise<T> {
  return new Promise<T>((resolve) => {
    const requestId = crypto.randomUUID()
    const timer = setTimeout(() => finish({ ok: false, message: "시간이 초과됐어요." } as T), TIMEOUTS[type])
    function finish(result: T) {
      clearTimeout(timer)
      window.removeEventListener("message", onMessage)
      resolve(result)
    }
    function onMessage(event: MessageEvent<ExtensionMessage>) {
      if (event.source !== window || event.origin !== window.location.origin) return
      const data = event.data
      if (data?.__connectnote_ext === true && data.type === "result" && data.requestId === requestId) {
        finish((data.result ?? { ok: false, message: "응답이 없어요." }) as T)
      }
    }
    window.addEventListener("message", onMessage)
    window.postMessage({ __connectnote_app: true, type, requestId, ...body }, window.location.origin)
  })
}

export function useConnectExtension() {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    function onMessage(event: MessageEvent<ExtensionMessage>) {
      if (event.source !== window || event.origin !== window.location.origin) return
      if (event.data?.__connectnote_ext === true && event.data.type === "ready") setVersion(event.data.version ?? "unknown")
    }
    window.addEventListener("message", onMessage)
    // 확장 프로그램이 먼저 신호를 보냈을 수 있으니 한 번 물어본다
    window.postMessage({ __connectnote_app: true, type: "ping" }, window.location.origin)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  const issueLink = useCallback(
    (product: { key: string; name: string; pageUrl: string | null }) => request<IssueLinkResult>("issue-link", { product }),
    [],
  )

  const writePost = useCallback(
    (payload: WritePostPayload) => request<WritePostResult>("write-post", { payload }),
    [],
  )

  return { available: version !== null, version, issueLink, writePost }
}

/** 버전 비교 (예: "0.5.0" >= "0.5.0") */
export function versionAtLeast(version: string | null, minimum: string): boolean {
  if (!version) return false
  const a = version.split(".").map(Number)
  const b = minimum.split(".").map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return true
}
