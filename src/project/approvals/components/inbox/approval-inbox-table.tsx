"use client"

import { useState, useMemo } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type PaginationState,
} from "@tanstack/react-table"
import { InboxIcon } from "lucide-react"

import { ApprovalInboxTabs } from "./approval-inbox-tabs"
import { ApprovalInboxFilters } from "./approval-inbox-filters"
import { ApprovalDetailDialog } from "./approval-detail-dialog"
import { createApprovalInboxColumns } from "../../columns/approval-inbox-columns"
import { useInbox, useRequestCounts } from "../../hooks/use-approvals"
import type { GetInboxRequestsInput } from "../../schemas/approval.schemas"
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid"
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table"
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination"
import type { InboxRow } from "../../types/inbox.types"

const PAGE_SIZE = 20

interface ApprovalInboxTableProps {
  initialPendingCount: number
  initialResolvedCount: number
}

export function ApprovalInboxTable({
  initialPendingCount,
  initialResolvedCount,
}: ApprovalInboxTableProps) {
  const [scope, setScope] = useState<"PENDING" | "RESOLVED">("PENDING")
  const [filters, setFilters] = useState<Partial<GetInboxRequestsInput>>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedRequest, setSelectedRequest] = useState<InboxRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const queryInput: GetInboxRequestsInput = {
    scope,
    domain: filters.domain,
    action: filters.action,
    requestedById: filters.requestedById,
    status: filters.status,
    page: pagination.pageIndex + 1,
    pageSize: PAGE_SIZE,
  }

  const { data, isLoading } = useInbox(queryInput)
  const { data: counts } = useRequestCounts()

  const pendingCount = counts?.pending ?? initialPendingCount
  const resolvedCount = counts?.resolved ?? initialResolvedCount

  const rows = data?.rows ?? []
  const total = data?.total ?? 0

  function handleView(row: InboxRow) {
    setSelectedRequest(row)
    setDetailOpen(true)
  }

  const columns = useMemo(
    () => createApprovalInboxColumns(handleView),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater(pagination) : updater
      setPagination(next)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / PAGE_SIZE),
  })

  function handleFiltersChange(newFilters: Partial<GetInboxRequestsInput>) {
    setFilters(newFilters)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  function handleScopeChange(newScope: "PENDING" | "RESOLVED") {
    setScope(newScope)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
    setFilters({})
  }

  return (
    <>
      <div className="space-y-4">
        {/* Tabs */}
        <ApprovalInboxTabs
          scope={scope}
          onScopeChange={handleScopeChange}
          pendingCount={pendingCount}
          resolvedCount={resolvedCount}
        />

        {/* Filtros */}
        <ApprovalInboxFilters
          filters={{ ...filters, scope }}
          onFiltersChange={handleFiltersChange}
        />

        {/* Tabla */}
        <DataGrid
          table={table}
          recordCount={total}
          isLoading={isLoading}
          emptyMessage={
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <InboxIcon className="text-muted-foreground h-10 w-10" />
              <p className="text-muted-foreground text-sm">
                {scope === "PENDING"
                  ? "No hay solicitudes pendientes. Cuando alguien pida una autorización aparecerá acá."
                  : "No hay solicitudes resueltas con los filtros seleccionados."}
              </p>
            </div>
          }
        >
          <DataGridContainer>
            <DataGridTable />
          </DataGridContainer>
          {total > PAGE_SIZE && (
            <DataGridPagination
              rowsPerPageLabel="Filas por página"
              info="{from} - {to} de {total}"
            />
          )}
        </DataGrid>
      </div>

      {/* Dialog de detalle */}
      <ApprovalDetailDialog
        request={selectedRequest}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  )
}
