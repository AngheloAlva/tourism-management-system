"use client"

import { APPROVAL_ACTION, APPROVAL_STATUS } from "@/generated/prisma/enums"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import { Input } from "@/shared/components/ui/input"
import { Button } from "@/shared/components/ui/button"
import { XIcon } from "lucide-react"
import {
  APPROVAL_DOMAINS,
  APPROVAL_ACTION_LABELS,
  APPROVAL_STATUS_LABELS,
  APPROVAL_DOMAIN_LABELS,
  type ApprovalDomain,
} from "../../constants/approval-actions"
import type { GetInboxRequestsInput } from "../../schemas/approval.schemas"

interface ApprovalInboxFiltersProps {
  filters: Partial<GetInboxRequestsInput>
  onFiltersChange: (filters: Partial<GetInboxRequestsInput>) => void
}

export function ApprovalInboxFilters({ filters, onFiltersChange }: ApprovalInboxFiltersProps) {
  const hasFilters =
    filters.domain || filters.action || filters.requestedById || filters.status

  function clearFilters() {
    onFiltersChange({})
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Dominio */}
      <Select
        value={filters.domain ?? ""}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, domain: value ? (value as ApprovalDomain) : undefined })
        }
      >
        <SelectTrigger className="h-8 w-[160px]">
          <SelectValue placeholder="Dominio" />
        </SelectTrigger>
        <SelectContent>
          {APPROVAL_DOMAINS.map((domain) => (
            <SelectItem key={domain} value={domain}>
              {APPROVAL_DOMAIN_LABELS[domain]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Acción */}
      <Select
        value={filters.action ?? ""}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, action: value ? (value as APPROVAL_ACTION) : undefined })
        }
      >
        <SelectTrigger className="h-8 w-[200px]">
          <SelectValue placeholder="Acción" />
        </SelectTrigger>
        <SelectContent>
          {Object.values(APPROVAL_ACTION).map((action) => (
            <SelectItem key={action} value={action}>
              {APPROVAL_ACTION_LABELS[action]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Estado (solo en tab Resueltas) */}
      {filters.scope === "RESOLVED" && (
        <Select
          value={filters.status ?? ""}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, status: value ? (value as APPROVAL_STATUS) : undefined })
          }
        >
          <SelectTrigger className="h-8 w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(APPROVAL_STATUS)
              .filter((s) => s !== APPROVAL_STATUS.PENDING)
              .map((status) => (
                <SelectItem key={status} value={status}>
                  {APPROVAL_STATUS_LABELS[status]}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      )}

      {/* Solicitante (ID o nombre — en PR1 es un input básico) */}
      <Input
        className="h-8 w-[180px]"
        placeholder="ID del solicitante"
        value={filters.requestedById ?? ""}
        onChange={(e) =>
          onFiltersChange({
            ...filters,
            requestedById: e.target.value || undefined,
          })
        }
      />

      {/* Limpiar filtros */}
      {hasFilters && (
        <Button size="sm" variant="ghost" onClick={clearFilters} className="h-8 gap-1">
          <XIcon className="h-3 w-3" />
          Limpiar
        </Button>
      )}
    </div>
  )
}
