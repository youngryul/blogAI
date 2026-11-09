// 브랜드 커넥트 화면이 받은 JSON 에서 ① 상품 목록(인기·추천·검색) ② 링크 발급 결과를 찾아낸다.
// 응답 형식이 공개되어 있지 않아 extract.js 와 같은 방식으로 필드 이름을 추측해서 읽는다.
// 상품 목록 = "상품명 + (가격 또는 이미지 또는 수수료)" 를 가진 객체가 3개 이상 들어 있는 배열.

const KEY_FIELDS = /^(productId|productNo|channelProductNo|originProductNo|nvMid|nvmid|itemId|itemNo|goodsNo|catalogId|mallProductId|id)$/i
const NAME_FIELDS = /^(productName|productTitle|itemName|goodsName|name|title)$/i
const PRICE_FIELDS = [/^(discountedSalePrice|discountedPrice|salePrice|finalPrice|lowPrice)$/i, /^(price|productPrice|originPrice)$/i]
const COMMISSION_FIELDS = /(commission|feeRate|rewardRate|reward|수수료)/i
const IMAGE_FIELDS = /(image|img|thumbnail|thumb)/i
const URL_FIELDS = /^(productUrl|productLink|mobileProductUrl|pcProductUrl|landingUrl|productPageUrl|url|link)$/i
const STORE_FIELDS = /^(storeName|mallName|channelName|sellerName|brandName|shopName)$/i
const CATEGORY_FIELDS = /^(wholeCategoryName|categoryFullName|categoryName|category|categoryPath)$/i
const RANK_FIELDS = /^(rank|ranking|rankNo|order|displayOrder|seq)$/i
// 발급된 커넥트 링크로 보이는 주소
const AFFILIATE_URL = /^https:\/\/(naver\.me\/|[a-z0-9.-]*brandconnect\.naver\.com\/[^\s"]*(link|short|redirect|\/l\/))/i
const AFFILIATE_FIELDS = /(short|affiliate|connect|issued|share).*(url|link)|^(link|url)$/i

const MAX_PRODUCTS = 300

function str(value, max = 500) {
  if (typeof value === "number" && Number.isFinite(value)) value = String(value)
  if (typeof value !== "string") return null
  const s = value.replace(/<[^>]+>/g, "").trim()
  return s ? s.slice(0, max) : null
}

function num(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const s = value.replace(/[,\s원%]/g, "")
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  }
  return null
}

function absoluteUrl(value) {
  const s = str(value, 1000)
  if (!s) return null
  if (s.startsWith("//")) return `https:${s}`
  return /^https?:\/\//i.test(s) ? s : null
}

/** 한 단계(필요하면 두 단계) 아래 객체의 필드까지 펼친다. 바깥 필드가 우선. */
function flatten(obj) {
  const out = {}
  const visit = (node, depth) => {
    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if (depth < 2) visit(v, depth + 1)
        // category: { name: "가습기" } 같은 경우
        if (CATEGORY_FIELDS.test(k) && !(k in out)) out[k] = v.wholeCategoryName ?? v.fullName ?? v.name ?? null
      } else if (!(k in out)) {
        out[k] = v
      }
    }
  }
  visit(obj, 0)
  return out
}

function pick(flat, pattern, convert) {
  for (const [k, v] of Object.entries(flat)) {
    if (!pattern.test(k)) continue
    const value = convert(v)
    if (value !== null && value !== undefined) return value
  }
  return null
}

function findAffiliateUrl(flat) {
  for (const [k, v] of Object.entries(flat)) {
    if (typeof v === "string" && AFFILIATE_URL.test(v.trim()) && (AFFILIATE_FIELDS.test(k) || /naver\.me/.test(v))) {
      return v.trim().slice(0, 500)
    }
  }
  return null
}

function commissionRate(flat) {
  // 비율(%)로 보이는 값만: 0~100 사이. 0.05 처럼 소수 비율이면 % 로 환산
  for (const [k, v] of Object.entries(flat)) {
    if (!COMMISSION_FIELDS.test(k) || /amount|price|money|won/i.test(k)) continue
    const n = num(v)
    if (n === null || n < 0) continue
    if (n > 0 && n < 1 && /rate|ratio/i.test(k)) return Math.round(n * 10000) / 100
    if (n <= 100) return n
  }
  return null
}

function productKey(flat, name, productUrl) {
  const id = pick(flat, KEY_FIELDS, (v) => str(v, 100))
  if (id) return `id:${id}`
  if (productUrl) return `url:${productUrl.split("?")[0]}`
  return `name:${name}`
}

function toProduct(item) {
  const flat = flatten(item)
  const name = pick(flat, NAME_FIELDS, (v) => str(v, 300))
  if (!name || name.length < 2) return null
  const price = PRICE_FIELDS.map((p) => pick(flat, p, num)).find((v) => v !== null) ?? null
  const imageUrl = pick(flat, IMAGE_FIELDS, absoluteUrl)
  const rate = commissionRate(flat)
  if (price === null && !imageUrl && rate === null) return null

  const affiliateUrl = findAffiliateUrl(flat)
  let productUrl = pick(flat, URL_FIELDS, absoluteUrl)
  if (productUrl && productUrl === affiliateUrl) productUrl = null

  return {
    key: productKey(flat, name, productUrl),
    name,
    price,
    commissionRate: rate,
    imageUrl,
    productUrl,
    storeName: pick(flat, STORE_FIELDS, (v) => str(v, 200)),
    category: pick(flat, CATEGORY_FIELDS, (v) => str(v, 300)),
    rank: pick(flat, RANK_FIELDS, (v) => {
      const n = num(v)
      return n !== null && Number.isInteger(n) && n >= 1 && n <= 10000 ? n : null
    }),
    affiliateUrl,
  }
}

/** 요청 주소·화면 주소로 목록 종류를 추측 */
function sourceFor(requestUrl, pageUrl) {
  const text = `${requestUrl} ${pageUrl}`.toLowerCase()
  if (/(popular|best|rank|top\d*|hot|trend|인기)/.test(text)) return "popular"
  if (/(recommend|suggest|curation|pick|추천)/.test(text)) return "recommended"
  return "search"
}

/**
 * @returns {{ products: object[], links: {key:string, affiliateUrl:string}[] }}
 */
export function extractConnectData(json, requestUrl, pageUrl) {
  const products = new Map()
  const links = new Map()
  const source = sourceFor(requestUrl, pageUrl)
  const seen = new Set()

  function walk(node, depth) {
    if (!node || typeof node !== "object" || depth > 12 || seen.has(node)) return
    seen.add(node)

    if (Array.isArray(node)) {
      const objects = node.filter((x) => x && typeof x === "object" && !Array.isArray(x))
      const parsed = objects.length >= 3 ? objects.map(toProduct) : []
      const valid = parsed.filter(Boolean)
      // 절반 이상이 상품처럼 보이면 상품 목록으로 본다
      if (valid.length >= 3 && valid.length >= objects.length / 2) {
        parsed.forEach((p, index) => {
          if (!p || products.size >= MAX_PRODUCTS) return
          const rank = p.rank ?? (source === "popular" ? index + 1 : null)
          if (!products.has(p.key)) products.set(p.key, { ...p, rank, source, pageUrl })
        })
        return
      }
      node.forEach((child) => walk(child, depth + 1))
      return
    }

    // 링크 발급 응답: { productId, shortUrl: "https://naver.me/..." } 처럼 단일 객체
    const flat = flatten(node)
    const affiliateUrl = findAffiliateUrl(flat)
    const id = pick(flat, KEY_FIELDS, (v) => str(v, 100))
    if (affiliateUrl && id) links.set(`id:${id}`, { key: `id:${id}`, affiliateUrl })

    Object.values(node).forEach((v) => walk(v, depth + 1))
  }

  walk(json, 0)

  // 목록 안에 링크가 이미 들어 있던 상품도 링크로 반영
  for (const p of products.values()) {
    if (p.affiliateUrl) links.set(p.key, { key: p.key, affiliateUrl: p.affiliateUrl })
  }
  return { products: [...products.values()], links: [...links.values()] }
}
