"use client"

import { useRef, useState } from "react"
import { ImageUp, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { STORAGE_BUCKETS } from "@/lib/constants"
import { createClient } from "@/lib/supabase/client"
import type { ProductRow } from "@/types"

export interface ProductFormValues {
  name: string
  category: string
  price: string
  productUrl: string
  affiliateUrl: string
  description: string
  features: string
  targetReader: string
  imageUrl: string
}

export const EMPTY_PRODUCT: ProductFormValues = {
  name: "",
  category: "",
  price: "",
  productUrl: "",
  affiliateUrl: "",
  description: "",
  features: "",
  targetReader: "",
  imageUrl: "",
}

export function productToFormValues(product: ProductRow): ProductFormValues {
  return {
    name: product.name,
    category: product.category ?? "",
    price: product.price != null ? String(product.price) : "",
    productUrl: product.product_url ?? "",
    affiliateUrl: product.affiliate_url ?? "",
    description: product.description ?? "",
    features: (product.features ?? []).join("\n"),
    targetReader: product.target_reader ?? "",
    imageUrl: product.image_url ?? "",
  }
}

/** API 요청 바디로 변환 */
export function formValuesToPayload(values: ProductFormValues) {
  return {
    name: values.name,
    category: values.category,
    price: values.price,
    productUrl: values.productUrl,
    affiliateUrl: values.affiliateUrl,
    description: values.description,
    features: values.features
      .split("\n")
      .map((f) => f.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean),
    targetReader: values.targetReader,
    imageUrl: values.imageUrl,
  }
}

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function ProductFields({
  values,
  onChange,
}: {
  values: ProductFormValues
  onChange: (values: ProductFormValues) => void
}) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (key: keyof ProductFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...values, [key]: e.target.value })

  async function handleUpload(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("이미지 파일만 업로드할 수 있습니다.")
    if (file.size > 5 * 1024 * 1024) return toast.error("5MB 이하 이미지를 업로드하세요.")
    setUploading(true)
    try {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error("로그인이 필요합니다.")
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const path = `${userData.user.id}/products/${crypto.randomUUID()}.${ext}`
      const bucket = supabase.storage.from(STORAGE_BUCKETS.productImages)
      const { error } = await bucket.upload(path, file, { contentType: file.type })
      if (error) throw error
      onChange({ ...values, imageUrl: bucket.getPublicUrl(path).data.publicUrl })
      toast.success("이미지를 업로드했습니다.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "업로드 실패")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="상품명 *" htmlFor="name">
          <Input id="name" value={values.name} onChange={set("name")} placeholder="예: 저소음 미니 가습기 300ml" required />
        </Field>
      </div>
      <Field label="상품 카테고리" htmlFor="category">
        <Input id="category" value={values.category} onChange={set("category")} placeholder="예: 생활가전 > 가습기" />
      </Field>
      <Field label="상품 가격 (원)" htmlFor="price">
        <Input id="price" inputMode="numeric" value={values.price} onChange={set("price")} placeholder="예: 29900" />
      </Field>
      <div className="sm:col-span-2">
        <Field
          label="쇼핑 커넥트 URL"
          htmlFor="affiliateUrl"
          hint="본문에 최대 2회 '상품 확인하기' 링크로 배치됩니다. 비워 두면 링크 없이 작성됩니다."
        >
          <Input id="affiliateUrl" value={values.affiliateUrl} onChange={set("affiliateUrl")} placeholder="https://naver.me/..." />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="상품 URL (원본 상품 페이지)" htmlFor="productUrl">
          <Input id="productUrl" value={values.productUrl} onChange={set("productUrl")} placeholder="https://smartstore.naver.com/..." />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field
          label="상품 설명"
          htmlFor="description"
          hint="AI 는 여기에 입력된 정보만 사실로 사용합니다. 상세 페이지의 핵심 정보를 정확히 옮겨 주세요."
        >
          <Textarea id="description" rows={4} value={values.description} onChange={set("description")} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="상품 주요 특징" htmlFor="features" hint="한 줄에 하나씩 입력하세요. (예: 용량 300ml / USB-C 충전 / 무드등 3단계)">
          <Textarea id="features" rows={4} value={values.features} onChange={set("features")} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="타깃 독자" htmlFor="targetReader">
          <Input
            id="targetReader"
            value={values.targetReader}
            onChange={set("targetReader")}
            placeholder="예: 원룸에 사는 20~30대 직장인"
          />
        </Field>
      </div>
      <div className="sm:col-span-2 space-y-2">
        <Label htmlFor="imageUrl">상품 대표 이미지</Label>
        <div className="flex gap-2">
          <Input
            id="imageUrl"
            value={values.imageUrl}
            onChange={set("imageUrl")}
            placeholder="이미지 URL 입력 또는 업로드"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUpload(file)
              e.target.value = ""
            }}
          />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <ImageUp />}
            업로드
          </Button>
        </div>
        {values.imageUrl && (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={values.imageUrl} alt="상품 대표 이미지" className="h-28 rounded-lg border object-cover" />
            <button
              type="button"
              onClick={() => onChange({ ...values, imageUrl: "" })}
              className="absolute -right-2 -top-2 rounded-full border bg-card p-1 shadow-sm"
              aria-label="이미지 제거"
            >
              <X className="size-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
