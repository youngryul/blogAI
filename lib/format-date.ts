const dateFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

export function formatDate(value: string | Date): string {
  return dateFormatter.format(new Date(value))
}

export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(new Date(value))
}
