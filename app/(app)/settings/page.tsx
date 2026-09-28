import type { Metadata } from "next"
import { revalidatePath } from "next/cache"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/layout/page-header"
import { DEFAULT_DISCLOSURE } from "@/lib/constants"
import { aiConfig, isAIMockMode } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import type { AIUsageRow, ProfileRow } from "@/types"

export const metadata: Metadata = { title: "설정" }

async function updateProfile(formData: FormData) {
  "use server"
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 50)
  await supabase.from("profiles").update({ display_name: displayName || null }).eq("id", data.user.id)
  revalidatePath("/settings")
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [{ data: profile }, { data: usage }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userData.user?.id ?? "").maybeSingle(),
    supabase
      .from("ai_usage")
      .select("action, model, input_tokens, output_tokens, image_count, estimated_cost")
      .gte("created_at", monthStart.toISOString()),
  ])

  const rows = (usage ?? []) as Pick<
    AIUsageRow,
    "action" | "model" | "input_tokens" | "output_tokens" | "image_count" | "estimated_cost"
  >[]
  const totals = rows.reduce(
    (acc, r) => ({
      calls: acc.calls + 1,
      input: acc.input + r.input_tokens,
      output: acc.output + r.output_tokens,
      images: acc.images + r.image_count,
      cost: acc.cost + Number(r.estimated_cost),
    }),
    { calls: 0, input: 0, output: 0, images: 0, cost: 0 },
  )
  const mock = isAIMockMode()
  const p = profile as ProfileRow | null

  return (
    <>
      <PageHeader title="설정" description="계정과 AI 사용 현황을 확인합니다." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>프로필</CardTitle>
            <CardDescription>{userData.user?.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateProfile} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="displayName">표시 이름</Label>
                <Input id="displayName" name="displayName" defaultValue={p?.display_name ?? ""} />
              </div>
              <Button type="submit">저장</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI 설정</CardTitle>
            <CardDescription>환경 변수로 설정합니다. (README 참고)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="모드">
              {mock ? <Badge variant="outline">Mock Mode</Badge> : <Badge>OpenAI 연결됨</Badge>}
            </Row>
            <Row label="텍스트 모델">{aiConfig.textModel}</Row>
            <Row label="이미지 모델">
              {aiConfig.imageModel} ({aiConfig.imageQuality})
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>이번 달 AI 사용량</CardTitle>
            <CardDescription>예상 비용은 추정치이며 실제 청구 금액과 다를 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <UsageStat label="AI 호출" value={`${totals.calls.toLocaleString()}회`} />
            <UsageStat label="이미지 생성" value={`${totals.images.toLocaleString()}장`} />
            <UsageStat label="입력 토큰" value={totals.input.toLocaleString()} />
            <UsageStat label="출력 토큰" value={totals.output.toLocaleString()} />
            <UsageStat label="예상 비용" value={`$${totals.cost.toFixed(3)}`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>콘텐츠 작성 원칙</CardTitle>
            <CardDescription>모든 AI 생성에 적용됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>· 입력한 상품 정보만 사실로 사용하며, 확인되지 않은 기능·효과를 만들지 않습니다.</p>
            <p>· 실제 사용하지 않은 제품을 사용한 것처럼 쓰지 않습니다.</p>
            <p>· 쇼핑 커넥트 링크는 기본 최대 2회만 배치합니다.</p>
            <p>· 네이버 블로그 자동 로그인·자동 발행 기능은 제공하지 않습니다. 복사 후 직접 게시하세요.</p>
            <p className="rounded-md bg-muted p-2 text-xs">기본 광고 표시 문구: {DEFAULT_DISCLOSURE}</p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  )
}

function UsageStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
