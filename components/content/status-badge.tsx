import { Badge } from "@/components/ui/badge"
import { CONTENT_STATUS_LABELS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { ContentStatus } from "@/types"

const STYLES: Record<ContentStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  generating: "bg-blue-50 text-blue-700",
  completed: "bg-primary/10 text-primary",
  published: "bg-violet-50 text-violet-700",
}

export function StatusBadge({ status, className }: { status: ContentStatus; className?: string }) {
  return (
    <Badge variant="secondary" className={cn(STYLES[status], className)}>
      {CONTENT_STATUS_LABELS[status]}
    </Badge>
  )
}
