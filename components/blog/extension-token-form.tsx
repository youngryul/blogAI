"use client"

import { useActionState, useState } from "react"
import { Check, Copy, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { manageExtensionToken, type ExtensionTokenState } from "@/app/(app)/settings/extension-actions"
import { cn } from "@/lib/utils"

interface Props {
  connected: boolean
  lastUsedAt: string | null
  appUrl: string
}

export function ExtensionTokenForm({ connected, lastUsedAt, appUrl }: Props) {
  const [state, action, pending] = useActionState<ExtensionTokenState, FormData>(manageExtensionToken, {
    ok: true,
    message: null,
    token: null,
  })
  const [copied, setCopied] = useState(false)

  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        상태:{" "}
        {connected ? (
          <span className="text-primary">
            ● 연결 코드 있음
            {lastUsedAt
              ? ` (마지막 수신 ${new Date(lastUsedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })})`
              : " (아직 받은 데이터 없음)"}
          </span>
        ) : (
          <span>연결 안 됨</span>
        )}
      </p>

      <div className="space-y-1">
        <p className="text-muted-foreground">확장 프로그램에 넣을 앱 주소</p>
        <Input readOnly value={appUrl} onFocus={(e) => e.currentTarget.select()} />
      </div>

      {state.token && (
        <div className="space-y-1 rounded-md border border-primary/40 bg-primary/5 p-3">
          <p className="font-medium">연결 코드 (이 화면을 벗어나면 다시 볼 수 없어요)</p>
          <div className="flex gap-2">
            <Input readOnly value={state.token} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="outline" size="icon" onClick={() => copy(state.token!)} aria-label="복사">
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
        </div>
      )}

      {state.message && <p className={cn(state.ok ? "text-primary" : "text-red-600")}>{state.message}</p>}

      <form action={action} className="flex gap-2">
        <Button type="submit" name="intent" value="create" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {connected ? "연결 코드 새로 만들기" : "연결 코드 만들기"}
        </Button>
        {connected && (
          <Button type="submit" name="intent" value="revoke" variant="ghost" disabled={pending}>
            연결 해제
          </Button>
        )}
      </form>
      <p className="text-xs text-muted-foreground">
        새로 만들면 이전 코드는 바로 무효가 됩니다. 연결 코드는 네이버 비밀번호가 아니며, 이 앱에 지표를 보내는 용도로만 쓰여요.
      </p>
    </div>
  )
}
