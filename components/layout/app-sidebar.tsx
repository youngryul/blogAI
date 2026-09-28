"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, LayoutDashboard, LogOut, Package, PenLine, Plus, Settings } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/content/new", label: "새 콘텐츠", icon: Plus },
  { href: "/contents", label: "콘텐츠", icon: FileText },
  { href: "/products", label: "상품", icon: Package },
  { href: "/settings", label: "설정", icon: Settings },
] as const

function isActive(pathname: string, href: string): boolean {
  if (href === "/content/new") return pathname === href
  if (href === "/contents") return pathname === "/contents" || (pathname.startsWith("/content/") && pathname !== "/content/new")
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppSidebar({ email, mockMode }: { email: string; mockMode: boolean }) {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card md:flex">
      <Link href="/dashboard" className="flex items-center gap-2 px-5 py-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <PenLine className="size-4" />
        </span>
        <span className="font-semibold">커넥트노트</span>
        {mockMode && (
          <Badge variant="outline" className="ml-auto text-[10px]">
            MOCK
          </Badge>
        )}
      </Link>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive(pathname, href)
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t p-4">
        <p className="truncate text-xs text-muted-foreground" title={email}>
          {email}
        </p>
        <form action="/auth/signout" method="post" className="mt-2">
          <button
            type="submit"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-3.5" />
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  )
}

export function MobileNav() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 overflow-x-auto border-b bg-card px-2 py-2 md:hidden">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs",
            isActive(pathname, href) ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground",
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
