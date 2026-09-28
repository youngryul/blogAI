"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"
import type { ContentBundle } from "@/types"

export const contentQueryKey = (id: string) => ["content", id] as const

export function useContentBundle(id: string) {
  return useQuery({
    queryKey: contentQueryKey(id),
    queryFn: () => apiFetch<ContentBundle>(`/api/contents/${id}`),
  })
}

export function useRefreshContent(id: string) {
  const queryClient = useQueryClient()
  return {
    refresh: () => queryClient.invalidateQueries({ queryKey: contentQueryKey(id) }),
    setBundle: (bundle: ContentBundle) => queryClient.setQueryData(contentQueryKey(id), bundle),
  }
}
