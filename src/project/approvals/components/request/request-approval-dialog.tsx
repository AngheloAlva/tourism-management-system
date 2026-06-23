"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ShieldCheckIcon } from "lucide-react"

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
} from "@/shared/components/ui/dialog"
import { Button } from "@/shared/components/ui/button"
import { Textarea } from "@/shared/components/ui/textarea"
import { Label } from "@/shared/components/ui/label"

import { APPROVAL_ACTION } from "@/generated/prisma/enums"
import { APPROVAL_ACTION_LABELS } from "../../constants/approval-actions"
import { requestApproval, resolveApproval } from "../../actions/approval.actions"

interface RequestApprovalDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	action: APPROVAL_ACTION
	targetType: string
	targetId: string
	targetLabel: string
	payload: unknown
	snapshot?: Record<string, unknown>
	targetFingerprint?: string
	defaultReason?: string
	isAdmin?: boolean
	onSuccess?: (result: { requestId?: string; executedDirectly?: boolean }) => void
}

/**
 * Dialog reutilizable para solicitar autorización de una acción destructiva.
 * - Admin: muestra botones "Solicitar" y "Solicitar y auto-aprobar"
 * - No admin: solo muestra "Solicitar autorización"
 *
 * El dialog NO está cableado a ningún dominio en PR1 — es la pieza reutilizable
 * que PR2/PR3 importan para reemplazar los dialogs de código existentes.
 */
export function RequestApprovalDialog({
	open,
	onOpenChange,
	action,
	targetType,
	targetId,
	targetLabel,
	payload,
	snapshot,
	targetFingerprint,
	defaultReason = "",
	isAdmin = false,
	onSuccess,
}: RequestApprovalDialogProps) {
	const [reason, setReason] = useState(defaultReason)
	const [reasonError, setReasonError] = useState("")
	const [isPending, setIsPending] = useState(false)
	const actionLabel = APPROVAL_ACTION_LABELS[action] ?? action

	function validateReason(): boolean {
		if (!reason.trim()) {
			setReasonError("El motivo es requerido")
			return false
		}
		if (reason.length > 1000) {
			setReasonError("El motivo no puede exceder los 1000 caracteres")
			return false
		}
		setReasonError("")
		return true
	}

	async function handleRequest(autoApprove: boolean) {
		if (!validateReason()) return

		setIsPending(true)
		try {
			const result = await requestApproval({
				action,
				targetType,
				targetId,
				payload,
				reason: reason.trim(),
				snapshot,
				targetFingerprint,
			})

			if ("error" in result) {
				toast.error(result.message)
				return
			}

			if (!result.approvalRequired) {
				// Flag OFF — ejecutó directo
				toast.success("Acción ejecutada.")
				onSuccess?.({ executedDirectly: true })
				onOpenChange(false)
				return
			}

			if (autoApprove) {
				// Admin auto-aprueba
				await resolveApproval({ requestId: result.requestId, decision: "APPROVE" })
				toast.success("Solicitud creada y aprobada. La acción fue ejecutada.")
			} else {
				toast.success("Solicitud enviada. Te avisamos por email cuando se resuelva.")
			}

			onSuccess?.({ requestId: result.requestId })
			setReason(defaultReason)
			onOpenChange(false)
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Error al enviar la solicitud")
		} finally {
			setIsPending(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<div className="flex items-center gap-2">
						<ShieldCheckIcon className="text-muted-foreground h-5 w-5" />
						<DialogTitle>Solicitar autorización</DialogTitle>
					</div>
					<DialogDescription>
						La acción <strong>{actionLabel}</strong> requiere aprobación de un administrador.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="bg-muted/30 rounded-md p-3 text-sm">
						<span className="text-muted-foreground">Recurso: </span>
						<strong>{targetLabel}</strong>
					</div>

					<div className="space-y-2">
						<Label htmlFor="approval-reason">
							Motivo <span className="text-destructive">*</span>
						</Label>
						<Textarea
							id="approval-reason"
							placeholder="Explicá brevemente por qué necesitás realizar esta acción..."
							rows={4}
							value={reason}
							onChange={(e) => {
								setReason(e.target.value)
								if (reasonError) setReasonError("")
							}}
							disabled={isPending}
						/>
						{reasonError && <p className="text-destructive text-sm">{reasonError}</p>}
					</div>

					<DialogFooter className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isPending}
						>
							Cancelar
						</Button>

						<Button
							type="button"
							variant="outline"
							disabled={isPending}
							onClick={() => handleRequest(false)}
						>
							{isPending ? "Enviando..." : "Solicitar autorización"}
						</Button>

						{isAdmin && (
							<Button type="button" disabled={isPending} onClick={() => handleRequest(true)}>
								{isPending ? "Ejecutando..." : "Solicitar y auto-aprobar"}
							</Button>
						)}
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	)
}
