"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { ExternalLink, Link2, Loader2, Sparkles, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { BRANDCONNECT_HOME, ConnectProductPicker } from "@/components/content/connect-product-picker"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { copyText } from "@/lib/clipboard"
import { useConnectExtension } from "@/hooks/use-connect-extension"
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
  type ConnectProductRow,
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
const LINK_POLL_MS = 3000
const LINK_POLL_TIMEOUT_MS = 10 * 60 * 1000

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
  products = [],
  connectProducts = [],
  initialProductId,
}: {
  products?: ProductRow[]
  connectProducts?: ConnectProductRow[]
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
  // 브랜드 커넥트에서 고른 상품과 링크 발급 대기 상태
  const [connectId, setConnectId] = useState<string | null>(null)
  const [waitingLink, setWaitingLink] = useState(false)
  // 확장 프로그램이 링크를 자동 발급 중인 브랜드 커넥트 상품 id (한 번에 하나)
  const [issuingId, setIssuingId] = useState<string | null>(null)
  const connectIdRef = useRef<string | null>(null)
  const extension = useConnectExtension()
  const picked = connectProducts.find((p) => p.id === connectId) ?? null

  useEffect(() => {
    connectIdRef.current = connectId
  }, [connectId])
  const writtenUrls = useMemo(
    () => new Set(products.map((p) => p.product_url).filter((u): u is string => Boolean(u))),
    [products],
  )

  function selectProduct(id: string) {
    setProductId(id)
    setConnectId(null)
    setWaitingLink(false)
    const found = products.find((p) => p.id === id)
    setProduct(found ? productToFormValues(found) : EMPTY_PRODUCT)
  }

  /** 브랜드 커넥트 상품 선택 → 같은 상품 URL 로 등록된 상품이 있으면 그 상품을 이어서 쓰고, 빈 칸만 채운다 */
  function pickConnectProduct(cp: ConnectProductRow) {
    const existing = cp.product_url ? products.find((p) => p.product_url === cp.product_url) : undefined
    const base = existing ? productToFormValues(existing) : EMPTY_PRODUCT
    setConnectId(cp.id)
    setWaitingLink(false)
    setProductId(existing?.id ?? NEW_PRODUCT)
    setProduct({
      ...base,
      name: base.name || cp.name,
      category: base.category || cp.category || "",
      price: base.price || (cp.price != null ? String(cp.price) : ""),
      productUrl: base.productUrl || cp.product_url || "",
      imageUrl: base.imageUrl || cp.image_url || "",
      affiliateUrl: cp.affiliate_url || base.affiliateUrl,
    })
    // 링크가 없으면 바로 자동 발급 (확장 프로그램이 있고, 다른 상품을 발급 중이 아닐 때)
    if (!cp.affiliate_url && !base.affiliateUrl && extension.available && !issuingId) void autoIssue(cp)
  }

  /** 확장 프로그램이 브랜드 커넥트 화면을 몰래 열어 '링크 발급'을 대신 누른다 */
  async function autoIssue(cp: ConnectProductRow) {
    setIssuingId(cp.id)
    try {
      const result = await extension.issueLink({ key: cp.product_key, name: cp.name, pageUrl: cp.page_url })
      const stillSelected = connectIdRef.current === cp.id
      if (result.ok && result.affiliateUrl) {
        if (stillSelected) {
          const url = result.affiliateUrl
          setProduct((prev) => ({ ...prev, affiliateUrl: url }))
          toast.success("커넥트 링크를 자동으로 발급해 입력했어요.")
        }
        router.refresh()
      } else if (result.ok) {
        // 화면에서는 못 읽었지만 발급 응답이 저장됐을 수 있다 → 잠시 확인
        if (stillSelected) setWaitingLink(true)
      } else if (stillSelected) {
        toast.error(`자동 발급 실패: ${result.message ?? "알 수 없는 오류"} 직접 발급해 주세요.`)
      }
    } finally {
      setIssuingId(null)
    }
  }

  async function openIssuePage() {
    if (!picked) return
    // 브랜드 커넥트 상품 찾기에서 바로 검색할 수 있게 상품명을 복사해 둔다
    await copyText(picked.name).catch(() => {})
    window.open(picked.page_url ?? BRANDCONNECT_HOME, "_blank", "noopener")
    setWaitingLink(true)
    toast.info("상품명을 복사했어요. 브랜드 커넥트에서 이 상품의 '링크 발급'을 누르면 자동으로 채워집니다.")
  }

  // 링크 발급 대기: 확장 프로그램이 발급 결과를 저장하면 쇼핑 커넥트 URL 을 채운다
  useEffect(() => {
    if (!waitingLink || !connectId) return
    const startedAt = Date.now()
    let cancelled = false
    const timer = setInterval(async () => {
      if (Date.now() - startedAt > LINK_POLL_TIMEOUT_MS) {
        clearInterval(timer)
        setWaitingLink(false)
        return
      }
      try {
        const latest = await apiFetch<ConnectProductRow>(`/api/connect-products/${connectId}`)
        if (cancelled || !latest.affiliate_url) return
        clearInterval(timer)
        setWaitingLink(false)
        setProduct((prev) => ({ ...prev, affiliateUrl: latest.affiliate_url ?? prev.affiliateUrl }))
        toast.success("커넥트 링크가 발급되어 입력했어요.")
        router.refresh()
      } catch {
        // 일시적인 오류는 다음 주기에 다시 시도
      }
    }, LINK_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [waitingLink, connectId, router])

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
      <div className="min-w-0 space-y-6">
      <ConnectProductPicker
        products={connectProducts}
        selectedId={connectId}
        writtenUrls={writtenUrls}
        onPick={pickConnectProduct}
      />
      <Card>
        <CardHeader>
          <CardTitle>상품 정보</CardTitle>
          <CardDescription>입력한 정보만 사실로 사용됩니다. 확인되지 않은 기능이나 효과는 글에 쓰이지 않아요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {picked && (
            <Alert>
              <Link2 />
              <AlertTitle>
                {product.affiliateUrl ? "커넥트 링크가 준비됐어요" : "이 상품은 아직 커넥트 링크가 없어요"}
              </AlertTitle>
              <AlertDescription className="space-y-2">
                {product.affiliateUrl ? (
                  <p>상품 설명과 주요 특징은 상세 페이지에서 확인해 채워 주세요. AI 는 입력한 정보만 사실로 씁니다.</p>
                ) : issuingId === picked.id ? (
                  <p className="flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    확장 프로그램이 브랜드 커넥트에서 링크를 발급하는 중이에요… (보통 10~20초)
                  </p>
                ) : waitingLink ? (
                  <p className="flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    링크 발급을 기다리는 중… 브랜드 커넥트에서 &lsquo;링크 발급&rsquo;을 누르면 자동으로 채워집니다. 발급된 링크를
                    아래 칸에 직접 붙여 넣어도 돼요.
                  </p>
                ) : extension.available ? (
                  <p>&lsquo;링크 자동 발급&rsquo;을 누르면 확장 프로그램이 브랜드 커넥트에서 대신 발급해 아래 칸에 넣어 줍니다.</p>
                ) : (
                  <p>
                    브랜드 커넥트에서 링크를 발급하면 확장 프로그램이 읽어 아래 쇼핑 커넥트 URL 에 자동으로 넣어 줍니다. 확장
                    프로그램을 0.4.0 이상으로 새로고침하면 자동 발급도 쓸 수 있어요.
                  </p>
                )}
                {!product.affiliateUrl && issuingId !== picked.id && (
                  <div className="flex flex-wrap gap-2">
                    {extension.available && (
                      <Button type="button" size="sm" onClick={() => void autoIssue(picked)} disabled={issuingId !== null}>
                        <Wand2 />
                        링크 자동 발급
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant={extension.available ? "outline" : "default"}
                      onClick={openIssuePage}
                    >
                      <ExternalLink />
                      {waitingLink ? "브랜드 커넥트 다시 열기" : extension.available ? "직접 발급하기" : "브랜드 커넥트에서 링크 발급"}
                    </Button>
                    {waitingLink && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setWaitingLink(false)}>
                        기다리지 않기
                      </Button>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
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
      </div>

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
