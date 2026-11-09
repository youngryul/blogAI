// 브랜드 커넥트 화면(격리된 world)에서 실행: 커넥트노트에서 "링크 발급"을 누르면 background.js 가 보낸 요청을 받아
// ① 화면에서 그 상품을 찾고(없으면 검색창에 상품명 입력) ② 상품 카드의 '링크 발급' 버튼을 대신 누른 뒤
// ③ 화면에 나타난 naver.me 링크를 읽어 돌려준다. 발급 응답(XHR)은 capture.js 가 따로 읽어 저장한다.
// 화면 구조가 공개되어 있지 않아 버튼 글자로 찾는다. 안 맞으면 아래 정규식을 고치면 된다.
;(() => {
  if (window.__connectNoteAutomate) return
  window.__connectNoteAutomate = true

  const ISSUE_TEXT = /(링크\s*(발급|생성|만들기|받기|복사))|^발급(하기)?$/
  const CONFIRM_TEXT = /^(발급|발급하기|링크\s*발급|확인|동의|동의하고\s*발급)$/
  const SEARCH_TEXT = /^(검색|찾기)$/
  const SHORT_LINK = /https:\/\/naver\.me\/[A-Za-z0-9]+/g
  const CLICKABLE = 'button, a, [role="button"], input[type="button"], input[type="submit"]'

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase()
  const textOf = (el) => norm(el.innerText || el.textContent || el.value || el.getAttribute?.("aria-label") || "")

  async function waitFor(fn, timeoutMs, intervalMs = 300) {
    const end = Date.now() + timeoutMs
    while (Date.now() < end) {
      const value = fn()
      if (value) return value
      await sleep(intervalMs)
    }
    return null
  }

  function isEnabled(el) {
    return !el.disabled && el.getAttribute("aria-disabled") !== "true"
  }

  /** 상품명이 들어 있는 가장 작은 요소 → 위로 올라가며 '링크 발급' 버튼을 가진 카드를 찾는다 */
  function findIssueButton(name) {
    const needle = norm(name).slice(0, 24)
    if (needle.length < 2) return null
    const holders = [...document.querySelectorAll("a, strong, em, span, p, div, li, h2, h3, h4, dt, dd")]
      .filter((el) => {
        const t = textOf(el)
        return t.length < 400 && t.includes(needle)
      })
      .sort((a, b) => textOf(a).length - textOf(b).length)

    for (const holder of holders.slice(0, 10)) {
      let node = holder
      for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
        const buttons = [...node.querySelectorAll(CLICKABLE)].filter((b) => ISSUE_TEXT.test(textOf(b)) && isEnabled(b))
        if (!buttons.length) continue
        // 처음 버튼이 보이는 단계에서 버튼이 여러 개면 여러 상품 카드를 감싼 목록이라 다른 상품일 수 있다 → 이 후보는 버림
        if (buttons.length === 1 || new Set(buttons.map(textOf)).size === buttons.length) {
          return buttons.find((b) => /발급/.test(textOf(b))) ?? buttons[0]
        }
        break
      }
    }
    return null
  }

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    setter ? setter.call(input, value) : (input.value = value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  }

  function pressEnter(input) {
    for (const type of ["keydown", "keypress", "keyup"]) {
      input.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }))
    }
  }

  /** 검색창에 상품명을 넣고 검색 */
  function search(name) {
    const input = document.querySelector(
      'input[type="search"], input[placeholder*="검색"], input[placeholder*="상품"], input[placeholder*="키워드"]',
    )
    if (!input) return false
    input.focus()
    setInputValue(input, name.slice(0, 50))
    pressEnter(input)
    const scope = input.closest("form") || input.parentElement?.parentElement || document
    const button = [...scope.querySelectorAll(CLICKABLE)].find((b) => SEARCH_TEXT.test(textOf(b)))
    button?.click()
    input.closest("form")?.requestSubmit?.()
    return true
  }

  function shortLinksOnPage() {
    const found = new Set()
    const collect = (text) => (text || "").match(SHORT_LINK)?.forEach((u) => found.add(u))
    collect(document.body?.innerText)
    document.querySelectorAll("input, textarea").forEach((el) => collect(el.value))
    document.querySelectorAll("[href*='naver.me'], [data-clipboard-text]").forEach((el) => {
      collect(el.getAttribute("href"))
      collect(el.getAttribute("data-clipboard-text"))
    })
    return found
  }

  async function issueLink(name) {
    if (/nid\.naver\.com/.test(location.hostname) || /\/login/i.test(location.pathname)) {
      return { ok: false, reason: "login", message: "네이버 로그인이 필요해요. 브랜드 커넥트에 로그인한 뒤 다시 시도하세요." }
    }

    let button = await waitFor(() => findIssueButton(name), 4000)
    if (!button) {
      if (!search(name)) {
        return { ok: false, reason: "no-search", message: "브랜드 커넥트 화면에서 검색창을 찾지 못했어요." }
      }
      button = await waitFor(() => findIssueButton(name), 12000)
    }
    if (!button) {
      return { ok: false, reason: "not-found", message: "브랜드 커넥트에서 이 상품이나 '링크 발급' 버튼을 찾지 못했어요." }
    }

    const before = shortLinksOnPage()
    button.scrollIntoView({ block: "center" })
    button.click()

    // 확인 팝업이 뜨면 한 번 눌러 주고, 새로 나타난 naver.me 링크를 기다린다
    let confirmed = false
    const link = await waitFor(() => {
      if (!confirmed) {
        const confirm = [...document.querySelectorAll(CLICKABLE)].find(
          (b) => b !== button && CONFIRM_TEXT.test(textOf(b)) && isEnabled(b) && b.closest('[role="dialog"], [class*="modal" i], [class*="layer" i], [class*="popup" i]'),
        )
        if (confirm) {
          confirmed = true
          confirm.click()
        }
      }
      return [...shortLinksOnPage()].find((u) => !before.has(u)) ?? null
    }, 12000)

    // 링크가 화면에 안 보여도 발급 응답은 capture.js 가 읽었을 수 있다
    return { ok: true, affiliateUrl: link ?? null }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "cn-issue-link" || typeof message.name !== "string") return false
    issueLink(message.name)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, reason: "error", message: String(error?.message || error) }))
    return true
  })
})()
