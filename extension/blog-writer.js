// 네이버 블로그(blog.naver.com) 모든 프레임에서 실행 (격리된 world).
// ① 글쓰기 에디터(SmartEditor ONE)가 있는 프레임이면 background.js 에 "준비됨"을 알리고,
//    요청이 오면 제목 → 본문(HTML) → 사진(파일) 순서로 "붙여넣기"해 채운다. 발행 버튼은 누르지 않는다.
// ② 글 보기 화면이면 주소를 알려 background.js 가 발행 완료(글 주소)를 앱에 기록하게 한다.
// 에디터 구조가 공개되어 있지 않아 클래스 이름(se-*)으로 찾는다. 안 맞으면 아래 SELECTORS 를 고치면 된다.
;(() => {
  if (window.__connectNoteBlogWriter) return
  window.__connectNoteBlogWriter = true

  const SELECTORS = {
    editorRoot: ".se-content, .se-wrap, #SE-root, [class*='se-container']",
    title: ".se-documentTitle .se-text-paragraph, .se-title-text .se-text-paragraph, .se-documentTitle [contenteditable]",
    bodyParagraph: ".se-component.se-text .se-text-paragraph",
    imageComponent: ".se-component.se-image, .se-component.se-imageStrip, .se-image-resource",
    // 처음 열 때 뜨는 "작성 중인 글" 팝업의 취소, 도움말 닫기
    dismiss: ".se-popup-button-cancel, .se-help-panel-close-button, button.se-help-close, .se-popup-close-button",
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const alive = () => Boolean(chrome.runtime?.id)

  function send(message) {
    if (!alive()) return
    try {
      chrome.runtime.sendMessage(message).catch(() => {})
    } catch {
      // 확장 프로그램이 새로고침된 뒤 남은 스크립트 — 무시
    }
  }

  async function waitFor(fn, timeoutMs, intervalMs = 300) {
    const end = Date.now() + timeoutMs
    while (Date.now() < end) {
      const value = fn()
      if (value) return value
      await sleep(intervalMs)
    }
    return null
  }

  /** 사람이 클릭한 것처럼 마우스 이벤트를 보내 커서를 그 위치에 둔다 */
  function realClick(el) {
    el.scrollIntoView({ block: "center" })
    const rect = el.getBoundingClientRect()
    const opts = { bubbles: true, cancelable: true, view: window, clientX: rect.left + rect.width - 2, clientY: rect.top + rect.height / 2, button: 0 }
    el.dispatchEvent(new PointerEvent("pointerdown", opts))
    el.dispatchEvent(new MouseEvent("mousedown", opts))
    el.dispatchEvent(new PointerEvent("pointerup", opts))
    el.dispatchEvent(new MouseEvent("mouseup", opts))
    el.dispatchEvent(new MouseEvent("click", opts))
  }

  /**
   * SmartEditor ONE 은 보이는 본문 칸이 아니라 화면 밖의 숨은 입력용 iframe(id="input_buffer…")으로
   * 키보드·붙여넣기를 받는다. 칸을 클릭하면 에디터가 그 iframe 에 포커스를 옮기므로, 그 안의 문서에 이벤트를 보낸다.
   */
  function inputBuffer() {
    const frames = [...document.querySelectorAll('iframe[id^="input_buffer"]')]
    const hasFocus = (f) => {
      try {
        return f.contentDocument?.hasFocus()
      } catch {
        return false
      }
    }
    const frame = frames.find((f) => f === document.activeElement) ?? frames.find(hasFocus) ?? frames[0]
    if (!frame) return null
    try {
      const doc = frame.contentDocument
      if (!doc?.body) return null
      const active = doc.activeElement
      return { frame, doc, target: active && active !== doc.documentElement ? active : doc.body }
    } catch {
      return null
    }
  }

  function focusBuffer() {
    const buffer = inputBuffer()
    if (!buffer) return null
    buffer.frame.contentWindow?.focus()
    buffer.doc.body.focus?.()
    return inputBuffer()
  }

  /** 붙여넣기 이벤트로 넣는다 — 에디터가 스스로 서식 변환·사진 업로드를 하게 하기 위함 */
  function paste({ html, text, files }) {
    const transfer = new DataTransfer()
    if (text) transfer.setData("text/plain", text)
    if (html) transfer.setData("text/html", html)
    for (const file of files ?? []) transfer.items.add(file)
    const buffer = focusBuffer()
    const target = buffer?.target ?? (document.activeElement && document.activeElement !== document.body ? document.activeElement : document)
    target.dispatchEvent(new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }))
    return Boolean(buffer)
  }

  /** 붙여넣기를 안 받을 때: 입력용 iframe 에 글자 입력 명령 */
  function insertText(text) {
    const buffer = focusBuffer()
    if (!buffer) return false
    try {
      return buffer.doc.execCommand("insertText", false, text)
    } catch {
      return false
    }
  }

  function dismissPopups() {
    document.querySelectorAll(SELECTORS.dismiss).forEach((button) => button.click())
  }

  /** 자리표시자("제목", "본문에 #을 이용하여…")를 뺀 실제 글자 */
  function realText(el) {
    if (!el) return ""
    const clone = el.cloneNode(true)
    clone.querySelectorAll(".se-placeholder, [class*='placeholder']").forEach((p) => p.remove())
    return (clone.textContent || "").replace(/​/g, "").trim()
  }

  function bodyParagraphs() {
    return [...document.querySelectorAll(SELECTORS.bodyParagraph)].filter((p) => !p.closest(".se-documentTitle"))
  }

  function bodyTextLength() {
    return bodyParagraphs().reduce((sum, p) => sum + realText(p).length, 0)
  }

  function imageCount() {
    return document.querySelectorAll(SELECTORS.imageComponent).length
  }

  async function dataUrlToFile(dataUrl, fileName) {
    const blob = await (await fetch(dataUrl)).blob()
    return new File([blob], fileName, { type: blob.type || "image/png" })
  }

  async function fillTitle(title) {
    const el = document.querySelector(SELECTORS.title)
    if (!el) return { ok: false, buffer: false }
    realClick(el)
    await sleep(300)
    const buffer = paste({ text: title })
    await sleep(500)
    if (!realText(el)) {
      realClick(el)
      await sleep(200)
      insertText(title)
      await sleep(400)
    }
    return { ok: Boolean(realText(el)), buffer }
  }

  /** 본문 마지막 문단을 클릭해 커서를 끝에 둔다 */
  async function focusBodyEnd() {
    const paragraphs = bodyParagraphs()
    const last = paragraphs[paragraphs.length - 1]
    if (!last) return false
    realClick(last)
    await sleep(250)
    return true
  }

  /** 에디터가 숨겨 둔 사진 파일 입력칸이 있으면 그걸로 올린다 (붙여넣기로 안 될 때) */
  function uploadViaFileInput(file) {
    const input = document.querySelector('input[type="file"][accept*="image"], input[type="file"]')
    if (!input) return false
    const transfer = new DataTransfer()
    transfer.items.add(file)
    input.files = transfer.files
    input.dispatchEvent(new Event("change", { bubbles: true }))
    return true
  }

  async function writePost(payload) {
    const titleEl = await waitFor(() => {
      dismissPopups()
      return document.querySelector(SELECTORS.title)
    }, 20000, 500)
    if (!titleEl) return { ok: false, message: "블로그 글쓰기 에디터를 찾지 못했어요. 네이버 로그인 상태를 확인하세요." }
    await sleep(800)
    dismissPopups()

    const title = await fillTitle(payload.title)
    if (!title.ok) {
      return {
        ok: false,
        message: title.buffer
          ? "제목 칸에 입력하지 못했어요. 에디터가 자동 입력을 받지 않는 것 같아요."
          : "에디터의 입력용 칸(input_buffer)을 찾지 못했어요.",
      }
    }

    let images = 0
    let failedImages = 0
    let failedText = 0
    for (const block of payload.blocks) {
      if (!(await focusBodyEnd())) return { ok: false, message: "본문 칸을 찾지 못했어요." }
      if (block.type === "html") {
        const before = bodyTextLength()
        paste({ html: block.html, text: block.text })
        await sleep(800)
        if (bodyTextLength() <= before) {
          // HTML 붙여넣기를 안 받으면 서식 없이 글자로라도 넣는다
          await focusBodyEnd()
          insertText(block.text)
          await sleep(600)
          if (bodyTextLength() <= before) failedText += 1
        }
      } else if (block.type === "image" && block.dataUrl) {
        const file = await dataUrlToFile(block.dataUrl, block.fileName)
        const before = imageCount()
        paste({ files: [file] })
        // 에디터가 사진을 업로드해 본문에 넣을 때까지 기다린다
        let added = await waitFor(() => imageCount() > before, 15000, 500)
        if (!added && uploadViaFileInput(file)) added = await waitFor(() => imageCount() > before, 20000, 500)
        if (added) images += 1
        else failedImages += 1
        await sleep(800)
      }
    }

    const expectedImages = payload.blocks.filter((b) => b.type === "image").length
    const textBlocks = payload.blocks.length - expectedImages
    if (failedText === textBlocks && textBlocks > 0) {
      return { ok: false, message: "제목은 넣었지만 본문을 넣지 못했어요. 미리보기의 '본문 복사'로 붙여 넣어 주세요." }
    }
    const warnings = []
    if (failedText) warnings.push(`본문 ${textBlocks}덩어리 중 ${failedText}개를 넣지 못했어요.`)
    if (failedImages) warnings.push(`사진 ${expectedImages}장 중 ${failedImages}장을 넣지 못했어요. 미리보기에서 받아 직접 올려 주세요.`)
    return { ok: true, images, expectedImages, message: warnings.join(" ") || null }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "cn-write-post") return false
    if (!document.querySelector(SELECTORS.editorRoot) && !document.querySelector(SELECTORS.title)) return false
    writePost(message.payload)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, message: String(error?.message || error) }))
    return true
  })

  // 에디터 프레임이면 준비됐다고 알림 (에디터는 늦게 그려지므로 잠시 기다려 본다)
  waitFor(() => document.querySelector(SELECTORS.title), 20000, 500).then((found) => {
    if (found) send({ type: "editor-ready", url: location.href })
  })

  // 글 보기 화면이면 주소를 알림 (발행 직후 이동하는 화면)
  send({ type: "blog-page", url: location.href })
})()
