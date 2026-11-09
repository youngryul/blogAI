// 네이버 화면이 받은 JSON 에서 "날짜별 숫자" 시리즈를 찾아 방문자 수 / 수익으로 뽑아낸다.
// 네이버 내부 응답 형식은 공개되어 있지 않아서, 특정 필드명에 고정하지 않고
// ① 행 형태 [{date, uv}, ...] ② 열 형태 {date:[...], uv:[...]} 를 모두 찾은 뒤 필드 이름으로 고른다.

/** 페이지 주소 → 이 화면에서 찾을 지표 종류 */
export function kindForPage(pageUrl) {
  let host
  try {
    host = new URL(pageUrl).hostname
  } catch {
    return null
  }
  if (host === "admin.blog.naver.com" || host === "blog.stat.naver.com") return "visitors"
  if (host === "adpost.naver.com" || host.endsWith(".adpost.naver.com")) return "adpost"
  if (host === "brandconnect.naver.com" || host.endsWith(".brandconnect.naver.com")) return "connect"
  return null
}

const PRIORITY = {
  visitors: [
    /^(uv|visitors?|visitorCo?u?nt|visitorCnt|uniqueVisitors?|uniqueVisitorCo?u?nt)$/i,
    /^(cv|visitCo?u?nt|visitCnt|visits?)$/i,
    /visitor/i,
    /^cnt$/i,
  ],
  adpost: [
    /(expect|estimat|예상).*(revenue|income|profit|earning|amount|수익)/i,
    /^(revenue|income|profit|earnings?|amount|totalRevenue|수익)$/i,
    /(revenue|income|profit|earning|수익)/i,
  ],
  connect: [
    /(expect|estimat|예상).*(revenue|commission|income|profit|amount|reward|수익|수수료)/i,
    /^(revenue|commission|income|profit|amount|reward|수익|수수료)$/i,
    /(revenue|commission|income|profit|reward|수익|수수료)/i,
  ],
}

const EXCLUDE = /(rate|ratio|percent|avg|average|ctr|rank|count.*click|click)/i
const DATE_KEY = /(date|day|^dt$|ymd|period|기간|날짜|일자)/i

function normalizeDate(value) {
  if (typeof value === "number" && value > 19000101 && value < 21001231) value = String(value)
  if (typeof value !== "string") return null
  const m = value.trim().match(/^(\d{4})[-./]?\s?(\d{1,2})[-./]?\s?(\d{1,2})/)
  if (!m) return null
  const [, y, mo, d] = m
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const s = value.replace(/[,\s원]/g, "")
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  }
  return null
}

function isRecentDate(date) {
  const t = Date.parse(`${date}T00:00:00+09:00`)
  const now = Date.now()
  return Number.isFinite(t) && t <= now + 2 * 86400000 && t >= now - 400 * 86400000
}

/** 필드명 → (날짜 → 값) */
function collectCandidates(root) {
  const candidates = new Map()
  const add = (field, date, value) => {
    if (!isRecentDate(date)) return
    if (!candidates.has(field)) candidates.set(field, new Map())
    candidates.get(field).set(date, value)
  }

  const seen = new Set()
  function walk(node, depth) {
    if (!node || typeof node !== "object" || depth > 12 || seen.has(node)) return
    seen.add(node)

    if (Array.isArray(node)) {
      node.forEach((child) => walk(child, depth + 1))
      return
    }

    const entries = Object.entries(node)

    // ① 행 형태: { date: "2026-11-08", uv: 12, ... } (한 단계 아래 객체 값도 포함)
    const dateEntry = entries.find(([k, v]) => DATE_KEY.test(k) && normalizeDate(v))
    if (dateEntry) {
      const date = normalizeDate(dateEntry[1])
      for (const [k, v] of entries) {
        if (k === dateEntry[0]) continue
        const n = toNumber(v)
        if (n !== null) add(k, date, n)
        else if (v && typeof v === "object" && !Array.isArray(v)) {
          for (const [k2, v2] of Object.entries(v)) {
            const n2 = toNumber(v2)
            if (n2 !== null) add(k2, date, n2)
          }
        }
      }
    }

    // ② 열 형태: { date: ["2026-11-04", ...], uv: [3, ...] }
    const dateColumn = entries.find(
      ([, v]) => Array.isArray(v) && v.length > 0 && v.every((x) => normalizeDate(x)),
    )
    if (dateColumn) {
      const dates = dateColumn[1].map(normalizeDate)
      for (const [k, v] of entries) {
        if (k === dateColumn[0] || !Array.isArray(v) || v.length !== dates.length) continue
        const nums = v.map(toNumber)
        if (nums.every((n) => n !== null)) dates.forEach((date, i) => add(k, date, nums[i]))
      }
    }

    entries.forEach(([, v]) => walk(v, depth + 1))
  }

  walk(root, 0)
  return candidates
}

/**
 * @returns {{ metrics: {date:string, kind:string, value:number}[], field: string | null }}
 */
export function extractMetrics(json, kind) {
  const candidates = collectCandidates(json)
  for (const pattern of PRIORITY[kind] ?? []) {
    let best = null
    for (const [field, series] of candidates) {
      if (!pattern.test(field) || EXCLUDE.test(field)) continue
      if (!best || series.size > best.series.size) best = { field, series }
    }
    if (best) {
      const metrics = [...best.series].map(([date, value]) => ({ date, kind, value: Math.max(0, value) }))
      return { metrics, field: best.field }
    }
  }
  return { metrics: [], field: null }
}
