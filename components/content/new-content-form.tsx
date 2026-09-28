"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  EMPTY_PRODUCT,
  ProductFields,
  formValuesToPayload,
  productToFormValues,
  type ProductFormValues,
} from "@/components/product/product-fields"
import { apiFetch, errorMessage } from "@/lib/api/client"
import {
  BRAND_TONES,
  CONTENT_TYPE_DESCRIPTIONS,
  CONTENT_TYPE_LABELS,
  CTA_LABELS,
  DISCLOSURE_POSITION_LABELS,
  LENGTH_LABELS,
} from "@/lib/constants"
import { cn } from "@/lib/utils"
import {
  CONTENT_TYPES,
  CTA_STRENGTHS,
  DISCLOSURE_POSITIONS,
  LENGTH_OPTIONS,
  type ContentRow,
  type ContentType,
  type CtaStrength,
  type DisclosurePosition,
  type LengthOption,
  type ProductRow,
} from "@/types"

const NEW_PRODUCT = "__new__"

function Segmented<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T
  options: readonly T[]
  labels: Record<T, string>
  onChange: (value: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border bg-muted/50 p-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm transition-colors",
            value === option ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  )
}

export function NewContentForm({
  products,
  initialProductId,
}: {
  products: ProductRow[]
  initialProductId: string | null
}) {
  const router = useRouter()
  const initial = products.find((p) => p.id === initialProductId)
  const [productId, setProductId] = useState<string>(initial?.id ?? NEW_PRODUCT)
  const [product, setProduct] = useState<ProductFormValues>(initial ? productToFormValues(initial) : EMPTY_PRODUCT)
  const [contentType, setContentType] = useState<ContentType>("informational")
  const [mainKeyword, setMainKeyword] = useState("")
  const [brandTone, setBrandTone] = useState<string>(BRAND_TONES[0])
  const [lengthOption, setLengthOption] = useState<LengthOption>("normal")
  const [ctaStrength, setCtaStrength] = useState<CtaStrength>("normal")
  const [disclosurePosition, setDisclosurePosition] = useState<DisclosurePosition>("top")
  const [submitting, setSubmitting] = useState(false)

  function selectProduct(id: string) {
    setProductId(id)
    const found = products.find((p) => p.id === id)
    setProduct(found ? productToFormValues(found) : EMPTY_PRODUCT)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!product.name.trim()) return toast.error("상품명을 입력하세요.")
    setSubmitting(true)
    try {
      // 기존 상품이면 입력값 변경사항을 반영하고, 새 상품이면 생성한다.
      const payload = formValuesToPayload(product)
      const saved =
        productId === NEW_PRODUCT
          ? await apiFetch<ProductRow>("/api/products", { body: payload })
          : await apiFetch<ProductRow>(`/api/products/${productId}`, { method: "PUT", body: payload })

      const content = await apiFetch<ContentRow>("/api/contents", {
        body: {
          productId: saved.id,
          contentType,
          mainKeyword,
          targetReader: product.targetReader,
          brandTone,
          lengthOption,
          ctaStrength,
          disclosurePosition,
        },
      })
      router.push(`/content/${content.id}/generate`)
    } catch (error) {
      toast.error(errorMessage(error))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <CardTitle>상품 정보</CardTitle>
          <CardDescription>입력한 정보만 사실로 사용됩니다. 확인되지 않은 기능이나 효과는 글에 쓰이지 않아요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {products.length > 0 && (
            <div className="space-y-2">
              <Label>상품 선택</Label>
              <Select value={productId} onValueChange={selectProduct}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_PRODUCT}>+ 새 상품 등록</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <ProductFields values={product} onChange={setProduct} />
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>콘텐츠 유형</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={contentType} onValueChange={(v) => setContentType(v as ContentType)} className="gap-2">
              {CONTENT_TYPES.map((type) => (
                <Label
                  key={type}
                  htmlFor={`type-${type}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal",
                    contentType === type && "border-primary bg-primary/5",
                  )}
                >
                  <RadioGroupItem id={`type-${type}`} value={type} className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{CONTENT_TYPE_LABELS[type]}</span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">
                      {CONTENT_TYPE_DESCRIPTIONS[type]}
                    </span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>글 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="mainKeyword">메인 키워드 (선택)</Label>
              <Input
                id="mainKeyword"
                value={mainKeyword}
                onChange={(e) => setMainKeyword(e.target.value)}
                placeholder="비워 두면 AI 가 추천합니다"
              />
            </div>
            <div className="space-y-2">
              <Label>브랜드 톤</Label>
              <Select value={brandTone} onValueChange={setBrandTone}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRAND_TONES.map((tone) => (
                    <SelectItem key={tone} value={tone}>
                      {tone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>글 길이</Label>
              <div>
                <Segmented value={lengthOption} options={LENGTH_OPTIONS} labels={LENGTH_LABELS} onChange={setLengthOption} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>CTA 강도</Label>
              <div>
                <Segmented value={ctaStrength} options={CTA_STRENGTHS} labels={CTA_LABELS} onChange={setCtaStrength} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>광고 표시 문구 위치</Label>
              <div>
                <Segmented
                  value={disclosurePosition}
                  options={DISCLOSURE_POSITIONS}
                  labels={DISCLOSURE_POSITION_LABELS}
                  onChange={setDisclosurePosition}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                경제적 이해관계 표시 문구는 기본으로 삽입되며, 에디터에서 수정할 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="h-11 w-full" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
          콘텐츠 생성 시작
        </Button>
      </div>
    </form>
  )
}
