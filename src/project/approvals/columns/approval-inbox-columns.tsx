"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { CheckCircleIcon, XCircleIcon, EyeIcon } from "lucide-react"

import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header"
import { APPROVAL_STATUS } from "@/generated/prisma/enums"
import {
  APPROVAL_ACTION_LABELS,
  APPROVAL_STATUS_LABELS,
  APPROVAL_DOMAIN_LABELS,
  type ApprovalDomain,
} from "../constants/approval-actions"
import type { InboxRow } from "../types/inbox.types"

const STATUS_VARIANTS: Record<
  APPROVAL_STATUS,
  "default" | "secondary" | "destructive" | "outline"
> = {
  [APPROVAL_STATUS.PENDING]: "default",
  [APPROVAL_STATUS.APPROVED]: "secondary",
  [APPROVAL_STATUS.EXECUTED]: "secondary",
  [APPROVAL_STATUS.REJECTED]: "destructive",
  [APPROVAL_STATUS.EXPIRED]: "outline",
  [APPROVAL_STATUS.INVALIDATED]: "outline",
  [APPROVAL_STATUS.FAILED]: "destructive",
}

const DOMAIN_COLORS: Record<ApprovalDomain, string> = {
  events: "bg-blue-100 text-blue-800",
  sales: "bg-green-100 text-green-800",
  transfers: "bg-purple-100 text-purple-800",
  receptions: "bg-orange-100 text-orange-800",
  agencies: "bg-yellow-100 text-yellow-800",
  providers: "bg-red-100 text-red-800",
  users: "bg-pink-100 text-pink-800",
  "cash-flow": "bg-teal-100 text-teal-800",
  commissions: "bg-indigo-100 text-indigo-800",
}

export function createApprovalInboxColumns(
  onView: (row: InboxRow) => void,
  onApprove?: (row: InboxRow) => void,
  onReject?: (row: InboxRow) => void
): ColumnDef<InboxRow>[] {
  return [
    {
      accessorKey: "requestedBy",
      header: ({ column }) => <DataGridColumnHeader column={column} title="Solicitante" />,
      cell: ({ row }) => {
        const user = row.original.requestedBy
        return (
          <div className="flex flex-col">
            <span className="font-medium">{user.name}</span>
            <span className="text-muted-foreground text-xs">{user.email}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "action",
      header: ({ column }) => <DataGridColumnHeader column={column} title="Acción" />,
      cell: ({ row }) => {
        const action = row.original.action
        return (
          <span className="text-sm font-medium">
            {APPROVAL_ACTION_LABELS[action] ?? action}
          </span>
        )
      },
    },
    {
      accessorKey: "domain",
      header: ({ column }) => <DataGridColumnHeader column={column} title="Dominio" />,
      cell: ({ row }) => {
        const domain = row.original.domain as ApprovalDomain
        const label = APPROVAL_DOMAIN_LABELS[domain] ?? domain
        const colorClass = DOMAIN_COLORS[domain] ?? "bg-gray-100 text-gray-800"
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
          >
            {label}
          </span>
        )
      },
    },
    {
      accessorKey: "targetId",
      header: ({ column }) => <DataGridColumnHeader column={column} title="Recurso" />,
      cell: ({ row }) => {
        const { targetType, targetId } = row.original
        return (
          <span className="text-muted-foreground text-sm">
            {targetType} #{targetId.slice(-8)}
          </span>
        )
      },
    },
    {
      accessorKey: "reason",
      header: ({ column }) => <DataGridColumnHeader column={column} title="Motivo" />,
      cell: ({ row }) => {
        const reason = row.original.reason
        if (!reason) return <span className="text-muted-foreground text-sm italic">Sin motivo</span>
        return (
          <span className="max-w-[200px] truncate text-sm" title={reason}>
            {reason.slice(0, 60)}{reason.length > 60 ? "..." : ""}
          </span>
        )
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <DataGridColumnHeader column={column} title="Solicitado" />,
      cell: ({ row }) => {
        const date = row.original.createdAt
        return (
          <span className="text-muted-foreground text-sm">
            {formatDistanceToNow(date, { addSuffix: true, locale: es })}
          </span>
        )
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataGridColumnHeader column={column} title="Estado" />,
      cell: ({ row }) => {
        const status = row.original.status
        return (
          <Badge variant={STATUS_VARIANTS[status]}>
            {APPROVAL_STATUS_LABELS[status] ?? status}
          </Badge>
        )
      },
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const isPending = row.original.status === APPROVAL_STATUS.PENDING
        return (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => onView(row.original)}>
              <EyeIcon className="h-4 w-4" />
              <span className="ml-1 text-xs">Ver</span>
            </Button>
            {isPending && onApprove && (
              <Button
                size="sm"
                variant="ghost"
                className="text-green-600 hover:text-green-700"
                onClick={() => onApprove(row.original)}
              >
                <CheckCircleIcon className="h-4 w-4" />
              </Button>
            )}
            {isPending && onReject && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => onReject(row.original)}
              >
                <XCircleIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        )
      },
    },
  ]
}
