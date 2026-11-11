import "server-only"

/**
 * 상품 페이지 URL(스마트스토어, 커넥트 링크 등)에서 대표 이미지를 찾는다.
 * 대부분의 쇼핑몰은 공유 미리보기용 og:image 메타 태그에 대표 사진을 넣어 두므로 그것을 우선 사용한다.
 * 커넥트 단축 링크(naver.me 등)는 리다이렉트를 따라가 최종 상품 페이지에서 찾는다.
 */
const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "ko-KR,ko;q=0.9",
}

const META_PATTERNS = [
  /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image(?::secure_url)?["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
  /"image"\s*:\s*\[?\s*"(https?:[^"]+)"/i, // JSON-LD Product.image
]

function decodeHtml(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\\u002F/gi, "/").trim()
}

export async function findImageFromPage(pageUrl: string | null | undefined): Promise<string | null> {
  if (!pageUrl?.trim() || !/^https?:\/\//.test(pageUrl)) return null
  try {
    const response = await fetch(pageUrl, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null
    if (response.headers.get("content-type")?.startsWith("image/")) return response.url
    // <head> 안에 있으므로 앞부분만 본다
    const html = (await response.text()).slice(0, 300_000)
    for (const pattern of META_PATTERNS) {
      const match = html.match(pattern)?.[1]
      if (!match) continue
      const url = new URL(decodeHtml(match), response.url).toString()
      if (/^https?:\/\//.test(url)) return url
    }
    return null
  } catch {
    return null
  }
}

/** 상품 URL → 커넥트 링크 순으로 대표 이미지를 찾는다 */
export async function findProductImage(product: {
  product_url: string | null
  affiliate_url: string | null
}): Promise<string | null> {
  for (const url of [product.product_url, product.affiliate_url]) {
    const found = await findImageFromPage(url)
    if (found) return found
  }
  return null
}
