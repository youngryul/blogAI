import {
  ALARM_NAME,
  closeHidden,
  isAppUrl,
  noteProductsCaptured,
  openHidden,
  refreshConnectProducts,
  rememberConnectPage,
  sleep,
  waitForLoad,
} from "./auto-refresh.js"
import { extractConnectData } from "./connect.js"
import { extractMetrics, kindForPage } from "./extract.js"

// 수집한 지표를 잠깐 모았다가(같은 날짜·종류는 최신 값으로 덮어씀) 앱으로 한 번에 보낸다.
const pending = new Map()
let flushTimer = null
// 브랜드 커넥트 상품 목록·발급 링크 (상품 키 기준으로 최신 값 유지)
const pendingProducts = new Map()
const pendingLinks = new Map()
let productTimer = null
const DEBUG_LIMIT = 20

async function getSettings() {
  const { appUrl = "http://localhost:3000", token = "" } = await chrome.storage.local.get(["appUrl", "token"])
  return { appUrl: appUrl.replace(/\/+$/, ""), token }
}

async function setStatus(patch) {
  const { status = {} } = await chrome.storage.local.get("status")
  await chrome.storage.local.set({ status: { ...status, ...patch } })
}

async function remember(entry) {
  const { captures = [] } = await chrome.storage.local.get("captures")
  captures.unshift(entry)
  await chrome.storage.local.set({ captures: captures.slice(0, DEBUG_LIMIT) })
}

async function postMetrics(metrics) {
  const { appUrl, token } = await getSettings()
  if (!token) throw new Error("연결 코드가 없습니다. 팝업에서 설정하세요.")
  const response = await fetch(`${appUrl}/api/extension/metrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ metrics }),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json?.error?.message || `HTTP ${response.status}`)
  return json.data
}

async function postConnectProducts(products, links) {
  const { appUrl, token } = await getSettings()
  if (!token) throw new Error("연결 코드가 없습니다. 팝업에서 설정하세요.")
  const response = await fetch(`${appUrl}/api/extension/connect-products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ products, links }),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json?.error?.message || `HTTP ${response.status}`)
  return json.data
}

async function flushProducts() {
  productTimer = null
  if (!pendingProducts.size && !pendingLinks.size) return
  const products = [...pendingProducts.values()]
  const links = [...pendingLinks.values()]
  pendingProducts.clear()
  pendingLinks.clear()
  try {
    const result = await postConnectProducts(products, links)
    await setStatus({
      lastProductsAt: new Date().toISOString(),
      lastProductsCount: result?.products ?? products.length,
      lastLinksCount: result?.links ?? links.length,
      lastError: null,
    })
  } catch (error) {
    await setStatus({ lastError: `${new Date().toLocaleString("ko-KR")} 상품 저장 실패: ${error.message}` })
  }
}

async function flush() {
  flushTimer = null
  if (!pending.size) return
  const metrics = [...pending.values()]
  pending.clear()
  try {
    const result = await postMetrics(metrics)
    const kinds = [...new Set(metrics.map((m) => m.kind))]
    await setStatus({ lastSentAt: new Date().toISOString(), lastSentCount: result?.saved ?? metrics.length, lastKinds: kinds, lastError: null })
  } catch (error) {
    await setStatus({ lastError: `${new Date().toLocaleString("ko-KR")} ${error.message}` })
  }
}

async function handleCapture(message, sender) {
  // 이 확장 프로그램의 content script 가 보낸 것만, 그리고 허용된 네이버 화면에서 온 것만 처리
  if (sender.id !== chrome.runtime.id) return
  const pageUrl = sender.url || message.pageUrl
  const kind = kindForPage(pageUrl)
  if (!kind || typeof message.body !== "string") return

  let json
  try {
    json = JSON.parse(message.body)
  } catch {
    return
  }

  const { metrics, field } = extractMetrics(json, kind)
  const connect = kind === "connect" ? extractConnectData(json, message.url, pageUrl) : { products: [], links: [] }
  await remember({
    at: new Date().toISOString(),
    page: pageUrl,
    url: message.url,
    kind,
    field,
    found: metrics.length,
    products: connect.products.length,
    links: connect.links.length,
    sample: message.body.slice(0, 3000),
  })

  if (connect.products.length) {
    noteProductsCaptured(connect.products.length)
    await rememberConnectPage(pageUrl)
  }
  if (connect.products.length || connect.links.length) {
    for (const p of connect.products) pendingProducts.set(p.key, p)
    for (const l of connect.links) pendingLinks.set(l.key, l)
    clearTimeout(productTimer)
    // 링크 발급 결과는 새 콘텐츠 화면에 바로 반영되도록 빨리 보낸다
    productTimer = setTimeout(flushProducts, connect.links.length ? 300 : 1500)
  }

  if (!metrics.length) return
  for (const m of metrics) pending.set(`${m.kind}:${m.date}`, m)
  clearTimeout(flushTimer)
  flushTimer = setTimeout(flush, 1500)
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "captured") {
    handleCapture(message, sender).catch((e) => console.error("[connectnote]", e))
    return false
  }
  if (message?.type === "issue-link") {
    isAppUrl(sender.url)
      .then((fromApp) => {
        // 커넥트노트 앱 화면(app-bridge.js)에서 온 요청만 처리
        if (sender.id !== chrome.runtime.id || !fromApp) return { ok: false, message: "허용되지 않은 요청이에요." }
        return issueLink(message.product)
      })
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, message: e.message }))
    return true
  }
  if (message?.type === "write-post") {
    isAppUrl(sender.url)
      .then((fromApp) => {
        if (sender.id !== chrome.runtime.id || !fromApp) return { ok: false, message: "허용되지 않은 요청이에요." }
        return writePost(message.payload)
      })
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, message: e.message }))
    return true
  }
  if (message?.type === "refresh-now") {
    refreshConnectProducts("manual")
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, message: e.message }))
    return true
  }
  if (message?.type === "test") {
    postMetrics([])
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, message: e.message }))
    return true
  }
  return false
})

// ---------------------------------------------------------------------------
// 브랜드 커넥트 상품 자동 갱신: 1시간마다 확인하되 실제 갱신은 20시간에 한 번
// ---------------------------------------------------------------------------
function ensureAlarm() {
  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm) chrome.alarms.create(ALARM_NAME, { delayInMinutes: 5, periodInMinutes: 60 })
  })
}

chrome.runtime.onInstalled.addListener(ensureAlarm)
chrome.runtime.onStartup.addListener(ensureAlarm)

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) refreshConnectProducts("alarm").catch((e) => console.error("[connectnote]", e))
})

// 커넥트노트 앱에 들어오면, 마지막 갱신 후 20시간이 지났을 때 바로 갱신
chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (info.status !== "complete") return
  isAppUrl(tab.url)
    .then((isApp) => (isApp ? refreshConnectProducts("app-visit") : null))
    .catch((e) => console.error("[connectnote]", e))
})

// ---------------------------------------------------------------------------
// 링크 자동 발급: 커넥트노트에서 요청 → 브랜드 커넥트 화면을 최소화 창으로 열고
// automate.js 가 그 상품의 '링크 발급' 버튼을 대신 누른다. 한 번에 한 상품씩만.
// ---------------------------------------------------------------------------
let issuing = false

function brandConnectUrl(value) {
  try {
    const url = new URL(value)
    const ok = url.protocol === "https:" && (url.hostname === "brandconnect.naver.com" || url.hostname.endsWith(".brandconnect.naver.com"))
    return ok ? url.toString() : null
  } catch {
    return null
  }
}

async function askTab(tabId, message, attempts = 6) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, message, { frameId: 0 })
    } catch {
      // 화면 스크립트가 아직 준비 전이면 잠시 후 다시
      await sleep(1000)
    }
  }
  return { ok: false, message: "브랜드 커넥트 화면이 응답하지 않아요. 네이버 로그인 상태를 확인하세요." }
}

async function issueLink(product) {
  const key = typeof product?.key === "string" ? product.key.slice(0, 200) : ""
  const name = typeof product?.name === "string" ? product.name.trim().slice(0, 300) : ""
  if (!key || !name) return { ok: false, message: "상품 정보가 올바르지 않아요." }
  if (issuing) return { ok: false, message: "다른 상품 링크를 발급하는 중이에요. 잠시 후 다시 시도하세요." }

  issuing = true
  let opened = null
  // 발급은 30초 넘게 걸릴 수 있다. 서비스 워커는 30초 동안 확장 API 호출이 없으면 잠들 수 있어 주기적으로 깨워 둔다
  const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo().catch(() => {}), 20_000)
  try {
    const { connectPages = [] } = await chrome.storage.local.get("connectPages")
    const url = brandConnectUrl(product.pageUrl) ?? connectPages[0]
    if (!url) return { ok: false, message: "브랜드 커넥트 상품 찾기 화면을 한 번 직접 열어 주세요." }

    opened = await openHidden(url)
    if (opened.tabId == null) return { ok: false, message: "브랜드 커넥트 화면을 열지 못했어요." }
    await waitForLoad(opened.tabId)
    await sleep(2500) // 목록이 그려질 시간

    const result = await askTab(opened.tabId, { type: "cn-issue-link", name })
    if (result?.ok && result.affiliateUrl) {
      pendingLinks.set(key, { key, affiliateUrl: result.affiliateUrl })
    }
    // 발급 응답(XHR)에서 잡힌 링크까지 함께 바로 저장
    await sleep(1500)
    clearTimeout(productTimer)
    await flushProducts()
    return result ?? { ok: false, message: "응답이 없어요." }
  } finally {
    clearInterval(keepAlive)
    if (opened) await closeHidden(opened)
    issuing = false
  }
}

// ---------------------------------------------------------------------------
// 배포 주소(localhost:3000/3100 이 아닌 앱 주소)에도 app-bridge.js 를 넣는다
// ---------------------------------------------------------------------------
const APP_BRIDGE_ID = "app-bridge"

async function syncAppBridge() {
  const { appUrl } = await getSettings()
  let origin
  try {
    origin = new URL(appUrl).origin
  } catch {
    return
  }
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [APP_BRIDGE_ID] })
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [APP_BRIDGE_ID] })
  if (/^http:\/\/localhost:(3000|3100)$/.test(origin)) return // manifest 에 이미 있음
  if (!(await chrome.permissions.contains({ origins: [`${origin}/*`] }))) return
  await chrome.scripting.registerContentScripts([
    { id: APP_BRIDGE_ID, matches: [`${origin}/*`], js: ["app-bridge.js"], runAt: "document_start" },
  ])
}

chrome.runtime.onInstalled.addListener(() => syncAppBridge().catch((e) => console.error("[connectnote]", e)))
chrome.runtime.onStartup.addListener(() => syncAppBridge().catch((e) => console.error("[connectnote]", e)))
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.appUrl) syncAppBridge().catch((e) => console.error("[connectnote]", e))
})

// ---------------------------------------------------------------------------
// 블로그 자동 작성: 커넥트노트에서 요청 → 글쓰기 화면을 새 탭으로 열고 blog-writer.js 가
// 제목·본문·사진을 채운다. 발행 버튼은 사용자가 직접 누른다.
// 발행 후 글 보기 화면으로 이동하면 그 주소를 앱에 "발행 완료"로 기록한다.
// ---------------------------------------------------------------------------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const editorWaiters = new Map() // tabId → resolve(frameId)
let writing = false

async function getWriteSessions() {
  const { writeSessions = {} } = await chrome.storage.session.get("writeSessions")
  return writeSessions
}

async function setWriteSession(tabId, value) {
  const sessions = await getWriteSessions()
  if (value) sessions[tabId] = value
  else delete sessions[tabId]
  await chrome.storage.session.set({ writeSessions: sessions })
}

function waitForEditor(tabId, timeoutMs = 45_000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      editorWaiters.delete(tabId)
      resolve(null)
    }, timeoutMs)
    editorWaiters.set(tabId, (frameId) => {
      clearTimeout(timer)
      editorWaiters.delete(tabId)
      resolve(frameId)
    })
  })
}

function validWritePayload(payload) {
  if (!payload || typeof payload.title !== "string" || !payload.title.trim()) return false
  if (typeof payload.contentId !== "string" || !UUID.test(payload.contentId)) return false
  if (!Array.isArray(payload.blocks) || payload.blocks.length === 0 || payload.blocks.length > 60) return false
  return payload.blocks.every(
    (b) =>
      (b?.type === "html" && typeof b.html === "string" && typeof b.text === "string") ||
      (b?.type === "image" && typeof b.dataUrl === "string" && b.dataUrl.startsWith("data:image/") && typeof b.fileName === "string"),
  )
}

async function writePost(payload) {
  if (!validWritePayload(payload)) return { ok: false, message: "글 내용이 올바르지 않아요." }
  if (writing) return { ok: false, message: "다른 글을 작성하는 중이에요." }
  writing = true
  const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo().catch(() => {}), 20_000)
  try {
    const blogId = typeof payload.blogId === "string" && /^[A-Za-z0-9_-]{3,40}$/.test(payload.blogId) ? payload.blogId : null
    const url = blogId ? `https://blog.naver.com/${blogId}/postwrite` : "https://blog.naver.com/GoBlogWrite.naver"
    // 사용자가 확인하고 발행해야 하므로 보이는 탭으로 연다
    const tab = await chrome.tabs.create({ url, active: true })
    const ready = waitForEditor(tab.id)
    await setWriteSession(tab.id, { contentId: payload.contentId, startedAt: Date.now() })

    const frameId = await ready
    if (frameId == null) return { ok: false, message: "글쓰기 화면이 열리지 않았어요. 네이버 로그인 상태를 확인하세요." }

    const result = await chrome.tabs
      .sendMessage(tab.id, { type: "cn-write-post", payload: { title: payload.title, blocks: payload.blocks } }, { frameId })
      .catch((e) => ({ ok: false, message: e.message }))
    return result ?? { ok: false, message: "응답이 없어요." }
  } finally {
    clearInterval(keepAlive)
    writing = false
  }
}

/** 블로그 글 보기 주소 → 정규 주소 (blog.naver.com/{id}/{logNo}) */
function postUrlFrom(value) {
  try {
    const url = new URL(value)
    if (url.hostname !== "blog.naver.com" && url.hostname !== "m.blog.naver.com") return null
    const blogId = url.searchParams.get("blogId")
    const logNo = url.searchParams.get("logNo")
    if (blogId && logNo && /^\d{6,}$/.test(logNo) && /PostView/i.test(url.pathname)) return `https://blog.naver.com/${blogId}/${logNo}`
    const match = url.pathname.match(/^\/([A-Za-z0-9_-]{3,40})\/(\d{6,})\/?$/)
    return match ? `https://blog.naver.com/${match[1]}/${match[2]}` : null
  } catch {
    return null
  }
}

async function recordPublished(contentId, blogUrl) {
  const { appUrl, token } = await getSettings()
  if (!token) return
  const response = await fetch(`${appUrl}/api/extension/published`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ contentId, blogUrl }),
  })
  if (!response.ok) {
    const json = await response.json().catch(() => ({}))
    throw new Error(json?.error?.message || `HTTP ${response.status}`)
  }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== chrome.runtime.id || !sender.tab) return false
  const tabId = sender.tab.id

  if (message?.type === "editor-ready") {
    editorWaiters.get(tabId)?.(sender.frameId ?? 0)
    return false
  }

  if (message?.type === "blog-page") {
    const blogUrl = postUrlFrom(message.url) ?? postUrlFrom(sender.url)
    if (!blogUrl) return false
    getWriteSessions()
      .then(async (sessions) => {
        const session = sessions[tabId]
        if (!session) return
        await setWriteSession(tabId, null)
        await recordPublished(session.contentId, blogUrl)
        await setStatus({ lastPublishedAt: new Date().toISOString(), lastPublishedUrl: blogUrl })
      })
      .catch((e) => setStatus({ lastError: `${new Date().toLocaleString("ko-KR")} 발행 기록 실패: ${e.message}` }))
    return false
  }
  return false
})

chrome.tabs.onRemoved.addListener((tabId) => {
  setWriteSession(tabId, null).catch(() => {})
})
