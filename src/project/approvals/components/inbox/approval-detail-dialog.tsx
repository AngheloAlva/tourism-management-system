"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CheckCircleIcon, XCircleIcon } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { Textarea } from "@/shared/components/ui/textarea"
import { Label } from "@/shared/components/ui/label"
import { Separator } from "@/shared/components/ui/separator"
import { toast } from "sonner"

import { APPROVAL_STATUS } from "@/generated/prisma/enums"
import {
  APPROVAL_ACTION_LABELS,
  APPROVAL_STATUS_LABELS,
  type ApprovalDomain,
  APPROVAL_DOMAIN_LABELS,
} from "../../constants/approval-actions"
import { computeDiff } from "../../utils/diff"
import { useResolveApproval } from "../../hooks/use-approvals"
import type { InboxRow } from "../../types/inbox.types"

interface ApprovalDetailDialogProps {
  request: InboxRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATUS_BADGE_VARIANTS: Record<
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

function DiffViewer({
  snapshot,
  currentState,
}: {
  snapshot: Record<string, unknown> | null
  currentState: Record<string, unknown> | null
}) {
  const diff = computeDiff(snapshot, currentState)

  if (diff.length === 0) {
    return (
      <p className="text-muted-foreground text-sm italic">
        No hay datos de snapshot disponibles.
      </p>
    )
  }

  return (
    <div className="rounded-md border text-sm">
      <div className="bg-muted/50 grid grid-cols-3 border-b px-3 py-1.5 text-xs font-medium">
        <span>Campo</span>
        <span>Al solicitar</span>
        <span>Estado actual</span>
      </div>
      {diff.map((entry) => (
        <div
          key={entry.field}
          className={`grid grid-cols-3 border-b px-3 py-1.5 last:border-0 ${
            entry.changed ? "bg-yellow-50" : ""
          }`}
        >
          <span className="text-muted-foreground font-medium">{entry.field}</span>
          <span
            className={
              entry.changed ? "text-red-600 line-through" : ""
            }
          >
            {formatValue(entry.before)}
          </span>
          <span className={entry.changed ? "text-green-600 font-medium" : ""}>
            {currentState === null ? (
              <em className="text-muted-foreground">No disponible</em>
            ) : (
              formatValue(entry.after)
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "Sí" : "No"
  if (value instanceof Date) return format(value, "dd/MM/yyyy HH:mm", { locale: es })
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export function ApprovalDetailDialog({
  request,
  open,
  onOpenChange,
}: ApprovalDetailDialogProps) {
  const [resolutionNote, setResolutionNote] = useState("")
  const resolveApproval = useResolveApproval()

  if (!request) return null

  const isPending = request.status === APPROVAL_STATUS.PENDING
  const domain = request.domain as ApprovalDomain

  async function handleDecision(decision: "APPROVE" | "REJECT") {
    if (!request) return

    try {
      await resolveApproval.mutateAsync({
        requestId: request.id,
        decision,
        resolutionNote: resolutionNote || undefined,
      })

      toast.success(
        decision === "APPROVE" ? "Solicitud aprobada y ejecutada." : "Solicitud rechazada."
      )
      setResolutionNote("")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar la solicitud")
    }
  }

  const snapshot = request.snapshot as Record<string, unknown> | null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-base">
              {APPROVAL_ACTION_LABELS[request.action] ?? request.action}
            </DialogTitle>
            <Badge variant={STATUS_BADGE_VARIANTS[request.status]}>
              {APPROVAL_STATUS_LABELS[request.status]}
            </Badge>
            {domain && (
              <Badge variant="outline" className="text-xs">
                {APPROVAL_DOMAIN_LABELS[domain] ?? domain}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {format(request.createdAt, "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Solicitante y motivo */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">Solicitante</h3>
            <div className="bg-muted/30 space-y-1 rounded-md p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Nombre:</span>{" "}
                <strong>{request.requestedBy.name}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Email:</span> {request.requestedBy.email}
              </p>
              <p>
                <span className="text-muted-foreground">Recurso:</span>{" "}
                {request.targetType} #{request.targetId.slice(-8)}
              </p>
              {request.reason && (
                <p>
                  <span className="text-muted-foreground">Motivo:</span>{" "}
                  <em>&ldquo;{request.reason}&rdquo;</em>
                </p>
              )}
            </div>
          </section>

          <Separator />

          {/* Snapshot / diff */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">Estado del recurso</h3>
            <DiffViewer snapshot={snapshot} currentState={null} />
            <p className="text-muted-foreground mt-1 text-xs">
              La columna &ldquo;Estado actual&rdquo; estará disponible a partir de PR2 cuando los dominios estén integrados.
            </p>
          </section>

          {/* Info de resolución (si ya está resuelta) */}
          {!isPending && request.resolvedBy && (
            <>
              <Separator />
              <section>
                <h3 className="mb-2 text-sm font-semibold">Resolución</h3>
                <div className="bg-muted/30 space-y-1 rounded-md p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">Resuelto por:</span>{" "}
                    {request.resolvedBy.name}
                  </p>
                  {request.resolvedAt && (
                    <p>
                      <span className="text-muted-foreground">Fecha:</span>{" "}
                      {format(request.resolvedAt, "dd/MM/yyyy HH:mm", { locale: es })}
                    </p>
                  )}
                  {request.executionError && (
                    <p>
                      <span className="text-muted-foreground">Error:</span>{" "}
                      <code className="text-destructive text-xs">{request.executionError}</code>
                    </p>
                  )}
                  {request.invalidationReason && (
                    <p>
                      <span className="text-muted-foreground">Motivo anulación:</span>{" "}
                      {request.invalidationReason}
                    </p>
                  )}
                </div>
              </section>
            </>
          )}

          {/* Acciones si PENDING */}
          {isPending && (
            <>
              <Separator />
              <section>
                <Label htmlFor="resolution-note" className="text-sm font-semibold">
                  Nota de resolución (opcional)
                </Label>
                <Textarea
                  id="resolution-note"
                  className="mt-1"
                  placeholder="Agregá una nota para el solicitante..."
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  rows={3}
                />
              </section>
            </>
          )}
        </div>

        {isPending && (
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              className="text-destructive border-destructive hover:bg-destructive/10"
              onClick={() => handleDecision("REJECT")}
              disabled={resolveApproval.isPending}
            >
              <XCircleIcon className="mr-1 h-4 w-4" />
              Rechazar
            </Button>
            <Button
              onClick={() => handleDecision("APPROVE")}
              disabled={resolveApproval.isPending}
            >
              <CheckCircleIcon className="mr-1 h-4 w-4" />
              {resolveApproval.isPending ? "Ejecutando..." : "Aprobar y ejecutar"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
