"use client"

import { AlertCircle, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Alert variant="destructive" className="max-w-xl">
      <AlertCircle />
      <AlertTitle>페이지를 불러오는 중 오류가 발생했습니다</AlertTitle>
      <AlertDescription>
        <p>{error.message}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={reset}>
          <RefreshCw /> 다시 시도
        </Button>
      </AlertDescription>
    </Alert>
  )
}
