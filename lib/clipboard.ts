/**
 * 클립보드 복사. SmartEditor 에 HTML 을 직접 주입하지 않고,
 * 사용자가 붙여넣을 수 있도록 rich text(text/html) + plain text 를 함께 클립보드에 담는다.
 */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  legacyCopy(text)
}

export async function copyRich(html: string, plain: string): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ])
      return
    } catch {
      // 일부 브라우저는 text/html 쓰기를 막는다 → plain 으로 폴백
    }
  }
  await copyText(plain)
}

function legacyCopy(text: string) {
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand("copy")
  textarea.remove()
}
