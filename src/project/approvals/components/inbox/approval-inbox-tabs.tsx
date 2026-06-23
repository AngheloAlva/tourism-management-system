"use client"

import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import { Badge } from "@/shared/components/ui/badge"

interface ApprovalInboxTabsProps {
  scope: "PENDING" | "RESOLVED"
  onScopeChange: (scope: "PENDING" | "RESOLVED") => void
  pendingCount: number
  resolvedCount: number
}

export function ApprovalInboxTabs({
  scope,
  onScopeChange,
  pendingCount,
  resolvedCount,
}: ApprovalInboxTabsProps) {
  return (
    <Tabs value={scope} onValueChange={(v) => onScopeChange(v as "PENDING" | "RESOLVED")}>
      <TabsList>
        <TabsTrigger value="PENDING" className="flex items-center gap-2">
          Pendientes
          {pendingCount > 0 && (
            <Badge
              variant="default"
              className="ml-1 h-5 min-w-5 rounded-full px-1 text-xs"
            >
              {pendingCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="RESOLVED" className="flex items-center gap-2">
          Resueltas
          {resolvedCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 h-5 min-w-5 rounded-full px-1 text-xs"
            >
              {resolvedCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
