import type { Metadata } from "next"
import { ContentPreview } from "@/components/content/content-preview"

export const metadata: Metadata = { title: "미리보기" }

export default async function PreviewPage({ params }: PageProps<"/content/[id]/preview">) {
  const { id } = await params
  return <ContentPreview contentId={id} />
}
