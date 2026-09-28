/** 이미지 URL 을 파일로 다운로드 (cross-origin 이미지도 blob 으로 받아 저장) */
export async function downloadImage(url: string, filename: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error("이미지를 내려받지 못했습니다.")
  const blob = await response.blob()
  const ext = blob.type.includes("svg") ? "svg" : blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg"
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = objectUrl
  a.download = `${filename.replace(/[\\/:*?"<>|]/g, "_")}.${ext}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}
