// 확장 프로그램 쪽(격리된 world)에서 실행: capture.js 가 넘긴 응답과
// 페이지에 처음부터 박혀 있는 JSON(__NEXT_DATA__ 등)을 background.js 로 전달한다.
;(() => {
  let alive = true

  // 확장 프로그램을 새로고침·업데이트하면, 이미 열려 있던 탭에 남은 이 스크립트는 연결이 끊긴다.
  // 이때 sendMessage 는 Promise 거부가 아니라 "동기적으로" 예외를 던지므로 try/catch 로 잡고 조용히 멈춘다.
  function stop() {
    alive = false
    window.removeEventListener("message", onMessage)
  }

  function send(url, body) {
    if (!alive) return
    if (!chrome.runtime?.id) return stop()
    try {
      chrome.runtime.sendMessage({ type: "captured", pageUrl: location.href, url, body }).catch((error) => {
        if (String(error?.message).includes("Extension context invalidated")) stop()
      })
    } catch {
      stop()
    }
  }

  function onMessage(event) {
    if (event.source !== window || !event.data || event.data.__connectnote !== true) return
    send(event.data.url, event.data.body)
  }

  window.addEventListener("message", onMessage)

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('script#__NEXT_DATA__, script[type="application/json"]').forEach((script) => {
      const text = (script.textContent || "").trim()
      if (text.startsWith("{") || text.startsWith("[")) send(`${location.href}#inline`, text)
    })
  })
})()
