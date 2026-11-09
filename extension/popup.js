const $ = (id) => document.getElementById(id)
const KIND_LABEL = { visitors: "방문자", adpost: "애드포스트", connect: "커넥트" }

function show(text, ok) {
  $("message").textContent = text
  $("message").className = ok ? "ok" : "err"
}

async function load() {
  const { appUrl = "http://localhost:3000", token = "", status = {} } = await chrome.storage.local.get([
    "appUrl",
    "token",
    "status",
  ])
  $("appUrl").value = appUrl
  $("token").value = token

  const lines = []
  if (status.lastSentAt) {
    const kinds = (status.lastKinds || []).map((k) => KIND_LABEL[k] || k).join(", ")
    lines.push(`✅ ${new Date(status.lastSentAt).toLocaleString("ko-KR")} · ${kinds} ${status.lastSentCount}건 저장`)
  }
  if (status.lastProductsAt) {
    const linkText = status.lastLinksCount ? ` · 링크 ${status.lastLinksCount}건` : ""
    lines.push(
      `🛍️ ${new Date(status.lastProductsAt).toLocaleString("ko-KR")} · 커넥트 상품 ${status.lastProductsCount}건${linkText} 저장`,
    )
  }
  if (status.lastError) lines.push(`⚠️ ${status.lastError}`)
  if (lines.length) $("status").textContent = lines.join("\n")
  $("status").style.whiteSpace = "pre-line"
}

$("save").addEventListener("click", async () => {
  let origin
  try {
    origin = new URL($("appUrl").value.trim()).origin
  } catch {
    return show("앱 주소가 올바르지 않습니다.", false)
  }
  const token = $("token").value.trim()
  if (!/^cn_[a-f0-9]{48}$/.test(token)) return show("연결 코드 형식이 올바르지 않습니다. 설정 화면에서 복사하세요.", false)

  // localhost:3000/3100 이 아닌 주소(배포 주소)는 그 주소에만 접근 권한을 요청
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] }).catch(() => false)
  if (!granted && !(await chrome.permissions.contains({ origins: [`${origin}/*`] }))) {
    return show("앱 주소 접근 권한이 필요합니다.", false)
  }

  await chrome.storage.local.set({ appUrl: origin, token })
  show("연결 확인 중…", true)
  const result = await chrome.runtime.sendMessage({ type: "test" })
  show(result?.ok ? "연결됐어요! 이제 네이버 화면을 열어 보세요." : `연결 실패: ${result?.message}`, Boolean(result?.ok))
})

async function loadAutoRefresh() {
  const { autoRefresh = true, lastAutoRefreshAt = null, connectPages = [], status = {} } = await chrome.storage.local.get([
    "autoRefresh",
    "lastAutoRefreshAt",
    "connectPages",
    "status",
  ])
  $("autoRefresh").checked = autoRefresh
  const lines = []
  if (lastAutoRefreshAt) lines.push(`마지막 시도: ${new Date(lastAutoRefreshAt).toLocaleString("ko-KR")}`)
  if (status.autoRefreshMessage) lines.push(status.autoRefreshMessage)
  if (!connectPages.length) lines.push("아직 기억한 상품 찾기 화면이 없어요. 브랜드 커넥트 상품 화면을 한 번 열어 주세요.")
  $("autoStatus").textContent = lines.join("\n")
  $("autoStatus").style.whiteSpace = "pre-line"
}

$("autoRefresh").addEventListener("change", async (event) => {
  await chrome.storage.local.set({ autoRefresh: event.target.checked })
  show(event.target.checked ? "자동 갱신을 켰어요." : "자동 갱신을 껐어요.", true)
})

$("refreshNow").addEventListener("click", async () => {
  $("refreshNow").disabled = true
  show("브랜드 커넥트 화면을 열어 상품을 읽는 중… (10초쯤 걸려요)", true)
  const result = await chrome.runtime.sendMessage({ type: "refresh-now" }).catch((e) => ({ ok: false, message: e.message }))
  show(result?.message ?? "갱신 결과를 알 수 없어요.", Boolean(result?.ok))
  $("refreshNow").disabled = false
  loadAutoRefresh()
})

$("copy").addEventListener("click", async () => {
  const { captures = [] } = await chrome.storage.local.get("captures")
  if (!captures.length) return show("아직 수집된 데이터가 없어요. 네이버 화면을 먼저 열어 주세요.", false)
  await navigator.clipboard.writeText(JSON.stringify(captures, null, 2))
  show(`최근 ${captures.length}건을 복사했어요.`, true)
})

document.querySelectorAll("[data-open]").forEach((link) =>
  link.addEventListener("click", (event) => {
    event.preventDefault()
    chrome.tabs.create({ url: link.dataset.open })
  }),
)

load()
loadAutoRefresh()
