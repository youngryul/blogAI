import type { Metadata } from "next"
import { NewContentForm } from "@/components/content/new-content-form"
import { PageHeader } from "@/components/layout/page-header"
import { createClient } from "@/lib/supabase/server"
import type { ConnectProductRow, ProductRow } from "@/types"

export const metadata: Metadata = { title: "새 콘텐츠" }

export default async function NewContentPage({ searchParams }: PageProps<"/content/new">) {
  const params = await searchParams
  const supabase = await createClient()
  const [{ data }, { data: connectData }] = await Promise.all([
    supabase.from("products").select("*").order("created_at", { ascending: false }).limit(100),
    // connect_products 마이그레이션 전이면 에러 → 빈 목록으로 보여준다
    supabase.from("connect_products").select("*").order("seen_at", { ascending: false }).limit(300),
  ])
  const products = (data ?? []) as ProductRow[]
  const connectProducts = (connectData ?? []) as ConnectProductRow[]
  const initialProductId = typeof params.productId === "string" ? params.productId : null

  return (
    <>
      <PageHeader
        title="새 콘텐츠 만들기"
        description="브랜드 커넥트 상품을 고르거나 상품 정보를 입력하면 키워드 분석부터 검수까지 단계별로 진행합니다."
      />
      <NewContentForm products={products} connectProducts={connectProducts} initialProductId={initialProductId} />
    </>
  )
}
