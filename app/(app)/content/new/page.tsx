import type { Metadata } from "next"
import { NewContentForm } from "@/components/content/new-content-form"
import { PageHeader } from "@/components/layout/page-header"
import { createClient } from "@/lib/supabase/server"
import type { ProductRow } from "@/types"

export const metadata: Metadata = { title: "새 콘텐츠" }

export default async function NewContentPage({ searchParams }: PageProps<"/content/new">) {
  const params = await searchParams
  const supabase = await createClient()
  const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false }).limit(100)
  const products = (data ?? []) as ProductRow[]
  const initialProductId = typeof params.productId === "string" ? params.productId : null

  return (
    <>
      <PageHeader
        title="새 콘텐츠 만들기"
        description="상품 정보와 글 설정을 입력하면 키워드 분석부터 검수까지 단계별로 진행합니다."
      />
      <NewContentForm products={products} initialProductId={initialProductId} />
    </>
  )
}
