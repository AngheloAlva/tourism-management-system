"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getInboxRequests, getRequestCounts } from "../server/queries"
import { resolveApproval } from "../actions/approval.actions"
import type { GetInboxRequestsInput } from "../schemas/approval.schemas"

// Re-export for use in client components that need the return type
export type { InboxRow } from "../types/inbox.types"

export function useInbox(input: GetInboxRequestsInput) {
  return useQuery({
    queryKey: ["approvals", "inbox", input],
    queryFn: () => getInboxRequests(input),
  })
}

export function useRequestCounts() {
  return useQuery({
    queryKey: ["approvals", "counts"],
    queryFn: () => getRequestCounts(),
    refetchInterval: 30_000, // re-fetch cada 30s para mantener badge actualizado
  })
}

export function useResolveApproval() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: resolveApproval,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] })
    },
  })
}
