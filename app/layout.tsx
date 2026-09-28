import type { Metadata } from "next"
import { Geist_Mono, Noto_Sans_KR } from "next/font/google"
import { Providers } from "@/components/providers"
import "./globals.css"

const notoSansKr = Noto_Sans_KR({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  preload: false,
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "커넥트노트 — 쇼핑 커넥트 블로그 콘텐츠 제작",
    template: "%s | 커넥트노트",
  },
  description: "네이버 쇼핑 커넥트 상품으로 키워드 분석부터 블로그 글, 이미지, 링크 배치까지 한 번에 준비하세요.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
