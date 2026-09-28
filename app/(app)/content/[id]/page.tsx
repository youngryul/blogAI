import type { Metadata } from "next"
import { ContentEditor } from "@/components/editor/content-editor"

export const metadata: Metadata = { title: "콘텐츠 편집" }

export default async function ContentEditorPage({ params }: PageProps<"/content/[id]">) {
  const { id } = await params
  return <ContentEditor contentId={id} />
}
