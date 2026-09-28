import type { Metadata } from "next"
import { ProductManager } from "@/components/product/product-manager"
import { createClient } from "@/lib/supabase/server"
import type { ProductRow } from "@/types"

export const metadata: Metadata = { title: "상품" }

export default async function ProductsPage() {
  const supabase = await createClient()
  const [{ data: products }, { data: contents }] = await Promise.all([
    supabase.from("products").select("*").order("created_at", { ascending: false }),
    supabase.from("contents").select("product_id"),
  ])

  const counts: Record<string, number> = {}
  for (const row of (contents ?? []) as { product_id: string }[]) {
    counts[row.product_id] = (counts[row.product_id] ?? 0) + 1
  }

  return <ProductManager products={(products ?? []) as ProductRow[]} contentCounts={counts} />
}
