// 페이지 안(MAIN world)에서 실행: 네이버 화면이 스스로 받아오는 JSON 응답을 옆에서 함께 읽는다.
// 요청을 새로 보내거나 내용을 바꾸지 않고, 이미 받은 응답의 복사본만 bridge.js 로 넘긴다.
;(() => {
  if (window.__connectNoteCapture) return
  window.__connectNoteCapture = true

  const MAX_LENGTH = 2_000_000

  function forward(url, text) {
    if (typeof text !== "string" || !text || text.length > MAX_LENGTH) return
    const body = text.trim()
    if (!(body.startsWith("{") || body.startsWith("["))) return
    window.postMessage({ __connectnote: true, url: String(url || ""), body }, location.origin)
  }

  const originalFetch = window.fetch
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args)
    try {
      const type = response.headers.get("content-type") || ""
      if (type.includes("json") || type.includes("text")) {
        response
          .clone()
          .text()
          .then((text) => forward(response.url, text))
          .catch(() => {})
      }
    } catch {
      // 수집 실패는 페이지 동작에 영향을 주지 않는다
    }
    return response
  }

  const originalOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__connectNoteUrl = url
    return originalOpen.call(this, method, url, ...rest)
  }

  const originalSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      try {
        const url = this.responseURL || this.__connectNoteUrl
        if (this.responseType === "" || this.responseType === "text") forward(url, this.responseText)
        else if (this.responseType === "json" && this.response) forward(url, JSON.stringify(this.response))
      } catch {
        // 무시
      }
    })
    return originalSend.apply(this, args)
  }
})()
