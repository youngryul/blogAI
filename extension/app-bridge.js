// 커넥트노트 앱 화면(격리된 world)에서 실행: 앱이 window.postMessage 로 보낸 요청을 background.js 로 넘기고 답을 돌려준다.
// 앱은 이 스크립트가 보내는 "ready" 신호로 확장 프로그램이 설치·연결됐는지 안다.
;(() => {
  if (window.__connectNoteAppBridge) return
  window.__connectNoteAppBridge = true

  const version = chrome.runtime.getManifest().version
  const post = (data) => window.postMessage({ __connectnote_ext: true, ...data }, location.origin)
  const announce = () => post({ type: "ready", version })

  function reply(requestId, result) {
    post({ type: "result", requestId, result })
  }

  const INVALIDATED = { ok: false, message: "확장 프로그램이 새로고침됐어요. 이 페이지를 새로 고쳐 주세요." }
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  // 백그라운드(서비스 워커)가 잠들어 있다 깨어나는 중이거나 막 업데이트된 직후에는
  // "Receiving end does not exist" 로 첫 메시지가 실패할 수 있어 몇 번 다시 보낸다.
  async function sendToBackground(message, attempts = 4) {
    let lastError = null
    for (let i = 0; i < attempts; i += 1) {
      if (!chrome.runtime?.id) return INVALIDATED
      try {
        return await chrome.runtime.sendMessage(message)
      } catch (error) {
        lastError = error
        const text = String(error?.message || error)
        if (text.includes("Extension context invalidated")) return INVALIDATED
        if (!text.includes("Receiving end does not exist")) break
        await sleep(700 * (i + 1))
      }
    }
    return {
      ok: false,
      message:
        "확장 프로그램 백그라운드가 응답하지 않아요. chrome://extensions 에서 커넥트노트 수집기의 '오류'를 확인하고 새로고침해 주세요. " +
        `(${String(lastError?.message || lastError)})`,
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return
    const data = event.data
    if (!data || data.__connectnote_app !== true) return

    if (data.type === "ping") return announce()

    if (data.type === "issue-link" && typeof data.requestId === "string") {
      sendToBackground({ type: "issue-link", product: data.product })
        .then((result) => reply(data.requestId, result ?? { ok: false, message: "응답이 없어요." }))
        .catch(() => reply(data.requestId, INVALIDATED))
    }

    if (data.type === "write-post" && typeof data.requestId === "string") {
      sendToBackground({ type: "write-post", payload: data.payload })
        .then((result) => reply(data.requestId, result ?? { ok: false, message: "응답이 없어요." }))
        .catch(() => reply(data.requestId, INVALIDATED))
    }
  })

  announce()
})()
