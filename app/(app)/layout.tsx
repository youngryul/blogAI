import { redirect } from "next/navigation"
import { AppSidebar, MobileNav } from "@/components/layout/app-sidebar"
import { SetupRequired } from "@/components/layout/setup-required"
import { isAIMockMode, isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!isSupabaseConfigured()) return <SetupRequired />

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect("/login")

  const mockMode = isAIMockMode()

  return (
    <div className="flex min-h-screen">
      <AppSidebar email={data.user.email ?? ""} mockMode={mockMode} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        {mockMode && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-800">
            Mock Mode: OPENAI_API_KEY 가 없어 샘플 AI 결과로 동작합니다. 실제 생성을 하려면 환경 변수를 설정하세요.
          </div>
        )}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  )
}
