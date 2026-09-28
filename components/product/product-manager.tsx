"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ExternalLink, Loader2, Package, Pencil, Plus, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PageHeader } from "@/components/layout/page-header"
import {
  EMPTY_PRODUCT,
  ProductFields,
  formValuesToPayload,
  productToFormValues,
  type ProductFormValues,
} from "@/components/product/product-fields"
import { apiFetch, errorMessage } from "@/lib/api/client"
import type { ProductRow } from "@/types"

export function ProductManager({
  products,
  contentCounts,
}: {
  products: ProductRow[]
  contentCounts: Record<string, number>
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<ProductRow | "new" | null>(null)
  const [values, setValues] = useState<ProductFormValues>(EMPTY_PRODUCT)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<ProductRow | null>(null)

  function openEditor(product: ProductRow | "new") {
    setEditing(product)
    setValues(product === "new" ? EMPTY_PRODUCT : productToFormValues(product))
  }

  async function save() {
    if (!values.name.trim()) return toast.error("상품명을 입력하세요.")
    setSaving(true)
    try {
      const body = formValuesToPayload(values)
      if (editing === "new") await apiFetch("/api/products", { body })
      else if (editing) await apiFetch(`/api/products/${editing.id}`, { method: "PUT", body })
      toast.success("상품을 저장했습니다.")
      setEditing(null)
      router.refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!deleting) return
    try {
      await apiFetch(`/api/products/${deleting.id}`, { method: "DELETE" })
      toast.success("상품을 삭제했습니다.")
      setDeleting(null)
      router.refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader
        title="상품"
        description="쇼핑 커넥트 상품 정보를 관리합니다. 입력한 정보만 글의 사실 근거로 사용됩니다."
        actions={
          <Button onClick={() => openEditor("new")}>
            <Plus /> 상품 등록
          </Button>
        }
      />

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Package className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">등록된 상품이 없습니다.</p>
            <Button size="sm" onClick={() => openEditor("new")}>
              상품 등록하기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id} className="gap-0 py-0">
              <div className="flex aspect-[16/9] items-center justify-center bg-muted">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <Package className="size-8 text-muted-foreground/50" />
                )}
              </div>
              <CardContent className="space-y-3 py-4">
                <div>
                  <p className="line-clamp-1 font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.category || "카테고리 없음"}
                    {product.price != null && ` · ${product.price.toLocaleString("ko-KR")}원`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">콘텐츠 {contentCounts[product.id] ?? 0}개</Badge>
                  {product.affiliate_url ? (
                    <Badge variant="outline" className="text-primary">
                      커넥트 링크 있음
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600">
                      커넥트 링크 없음
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild size="sm" className="flex-1">
                    <Link href={`/content/new?productId=${product.id}`}>
                      <Sparkles /> 콘텐츠 만들기
                    </Link>
                  </Button>
                  {product.product_url && (
                    <Button asChild size="icon-sm" variant="ghost" aria-label="상품 페이지">
                      <a href={product.product_url} target="_blank" rel="noreferrer">
                        <ExternalLink />
                      </a>
                    </Button>
                  )}
                  <Button size="icon-sm" variant="ghost" aria-label="수정" onClick={() => openEditor(product)}>
                    <Pencil />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="삭제" onClick={() => setDeleting(product)}>
                    <Trash2 />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "상품 등록" : "상품 수정"}</DialogTitle>
            <DialogDescription>AI 는 여기에 입력된 정보만 사실로 취급합니다.</DialogDescription>
          </DialogHeader>
          <ProductFields values={values} onChange={setValues} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              취소
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>상품을 삭제할까요?</DialogTitle>
            <DialogDescription>
              이 상품으로 만든 콘텐츠 {deleting ? (contentCounts[deleting.id] ?? 0) : 0}개도 함께 삭제되며 되돌릴 수
              없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              취소
            </Button>
            <Button variant="destructive" onClick={remove}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
