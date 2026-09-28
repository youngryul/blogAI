export function SetupRequired() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Supabase 설정이 필요합니다</h1>
      <p className="text-muted-foreground">
        프로젝트 루트에 <code className="rounded bg-muted px-1">.env.local</code> 파일을 만들고 아래 값을 입력한 뒤 개발
        서버를 다시 시작하세요. 자세한 방법은 README 를 참고하세요.
      </p>
      <pre className="overflow-x-auto rounded-lg border bg-card p-4 text-sm">
        {`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...   # 없으면 Mock Mode`}
      </pre>
    </main>
  )
}
