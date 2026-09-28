import type { Metadata } from "next"
import { GenerationRunner } from "@/components/content/generation-runner"

export const metadata: Metadata = { title: "콘텐츠 생성" }

export default async function GeneratePage({ params }: PageProps<"/content/[id]/generate">) {
  const { id } = await params
  return <GenerationRunner contentId={id} />
}
