// 브랜드 커넥트 상품 목록 자동 갱신 (하루 1번 정도)
// 상품이 잡혔던 브랜드 커넥트 화면 주소를 기억해 두었다가, 마지막 갱신 후 20시간이 지나면
// ① 크롬이 켜져 있을 때 1시간마다 확인하는 알람 ② 커넥트노트 앱에 들어올 때 — 둘 중 먼저 오는 때에
// 최소화된 창으로 그 화면을 잠깐 열었다 닫는다. 화면이 스스로 받아오는 응답을 평소처럼 읽을 뿐,
// 확장 프로그램이 네이버에 요청을 직접 만들지는 않는다.

const REFRESH_INTERVAL_MS = 20 * 60 * 60 * 1000
const MAX_PAGES = 3
const PAGE_LOAD_TIMEOUT_MS = 30_000
// 화면이 열린 뒤 목록 응답(XHR)이 오기를 기다리는 시간
const SETTLE_MS = 8_000
export const ALARM_NAME = "connect-refresh"

let running = false
// 갱신 중에 상품 목록이 실제로 잡혔는지 (background.js 가 알려 줌)
let capturedDuringRefresh = 0

export function noteProductsCaptured(count) {
  if (running) capturedDuringRefresh += count
}

async function getState() {
  const { autoRefresh = true, connectPages = [], lastAutoRefreshAt = null } = await chrome.storage.local.get([
    "autoRefresh",
    "connectPages",
    "lastAutoRefreshAt",
  ])
  return { autoRefresh, connectPages, lastAutoRefreshAt }
}

async function setStatus(patch) {
  const { status = {} } = await chrome.storage.local.get("status")
  await chrome.storage.local.set({ status: { ...status, ...patch } })
}

/** 상품이 잡힌 브랜드 커넥트 화면 주소를 기억 (최근 것 우선, 최대 3개) */
export async function rememberConnectPage(pageUrl) {
  let url
  try {
    url = new URL(pageUrl)
  } catch {
    return
  }
  if (url.protocol !== "https:" || !(url.hostname === "brandconnect.naver.com" || url.hostname.endsWith(".brandconnect.naver.com"))) return
  url.hash = ""
  const clean = url.toString()
  const { connectPages } = await getState()
  if (connectPages[0] === clean) return
  await chrome.storage.local.set({ connectPages: [clean, ...connectPages.filter((p) => p !== clean)].slice(0, MAX_PAGES) })
}

export function waitForLoad(tabId) {
  return new Promise((resolve) => {
    const done = (result) => {
      clearTimeout(timer)
      chrome.tabs.onUpdated.removeListener(listener)
      resolve(result)
    }
    const listener = (id, info, tab) => {
      if (id === tabId && info.status === "complete") done(tab)
    }
    const timer = setTimeout(() => done(null), PAGE_LOAD_TIMEOUT_MS)
    chrome.tabs.onUpdated.addListener(listener)
  })
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 사용자 화면을 가리지 않게 최소화된 창으로 연다 (실패하면 비활성 탭) */
export async function openHidden(url) {
  try {
    const win = await chrome.windows.create({ url, focused: false, state: "minimized", type: "normal" })
    return { windowId: win.id, tabId: win.tabs?.[0]?.id ?? null }
  } catch {
    const tab = await chrome.tabs.create({ url, active: false })
    return { windowId: null, tabId: tab.id }
  }
}

export async function closeHidden({ windowId, tabId }) {
  if (windowId != null) await chrome.windows.remove(windowId).catch(() => {})
  else if (tabId != null) await chrome.tabs.remove(tabId).catch(() => {})
}

/** 백그라운드에서 화면 하나 열기 → 응답 받을 시간 기다리기 → 닫기 */
async function visit(url) {
  const opened = await openHidden(url)
  try {
    if (opened.tabId == null) return
    await waitForLoad(opened.tabId)
    await sleep(SETTLE_MS)
  } finally {
    await closeHidden(opened)
  }
}

/**
 * @param {"alarm" | "app-visit" | "manual"} reason manual 은 20시간 제한과 자동 갱신 끄기를 무시한다
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function refreshConnectProducts(reason) {
  // 알람과 앱 방문이 거의 동시에 와도 한 번만 돌도록, 첫 await 전에 잠근다
  if (running) return { ok: false, message: "이미 갱신 중이에요." }
  running = true
  capturedDuringRefresh = 0
  try {
    const { autoRefresh, connectPages, lastAutoRefreshAt } = await getState()
    if (reason !== "manual") {
      if (!autoRefresh) return { ok: false, message: "자동 갱신이 꺼져 있어요." }
      if (lastAutoRefreshAt && Date.now() - Date.parse(lastAutoRefreshAt) < REFRESH_INTERVAL_MS) {
        return { ok: false, message: "최근에 갱신했어요." }
      }
    }
    const { token = "" } = await chrome.storage.local.get("token")
    if (!token) return { ok: false, message: "연결 코드를 먼저 설정하세요." }
    if (!connectPages.length) {
      const message = "브랜드 커넥트 상품 찾기 화면을 한 번 직접 열어 주세요. 그 주소로 자동 갱신합니다."
      await setStatus({ autoRefreshMessage: message })
      return { ok: false, message }
    }

    // 실패해도 매시간 다시 열지 않도록 시작 시각을 먼저 기록
    await chrome.storage.local.set({ lastAutoRefreshAt: new Date().toISOString() })
    for (const url of connectPages) await visit(url)
    if (!capturedDuringRefresh) {
      // 로그인 화면으로 넘어갔거나 화면 구성이 바뀐 경우
      const message = `${new Date().toLocaleString("ko-KR")} 상품을 읽지 못했어요. 네이버 로그인 상태를 확인한 뒤 '지금 갱신'을 눌러 주세요.`
      await setStatus({ autoRefreshMessage: message })
      return { ok: false, message }
    }
    const message = `${new Date().toLocaleString("ko-KR")} 자동 갱신 완료 (상품 ${capturedDuringRefresh}건)`
    await setStatus({ autoRefreshMessage: message })
    return { ok: true, message }
  } finally {
    running = false
  }
}

/** 커넥트노트 앱 탭이 열렸는지 — 설정한 앱 주소와 같은 origin 인지로 판단 */
export async function isAppUrl(url) {
  if (!url) return false
  const { appUrl = "http://localhost:3000" } = await chrome.storage.local.get("appUrl")
  try {
    return new URL(url).origin === new URL(appUrl).origin
  } catch {
    return false
  }
}
