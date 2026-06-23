"use client"

import { useEffect, useState } from "react"
import { HistoryIcon } from "lucide-react"

import { getAuditLogsByEntity } from "@/shared/actions/audit-log.actions"
import { AuditLogList } from "./audit-log-list"

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog"

import type { AuditLog } from "@/generated/prisma/client"

interface AuditDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	entityType: string
	entityId: string
	entityName?: string
}

export function AuditDialog({
	open,
	onOpenChange,
	entityType,
	entityId,
	entityName,
}: AuditDialogProps) {
	const [logs, setLogs] = useState<AuditLog[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [createdBy, setCreatedBy] = useState<{ name?: string; createdAt?: Date } | undefined>(
		undefined
	)

	const loadAuditLogs = async () => {
		setIsLoading(true)
		setError(null)
		try {
			const data = await getAuditLogsByEntity(entityType, entityId)
			setLogs(data.logs)
			console.log({ data })
			setCreatedBy(data.createdBy)
		} catch (err) {
			setError("Error al cargar el historial de cambios")
			console.error(err)
		} finally {
			setIsLoading(false)
		}
	}

	useEffect(() => {
		if (open && entityId) {
			loadAuditLogs()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, entityId])

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<div className="flex items-center gap-2">
						<HistoryIcon className="h-5 w-5" />
						<DialogTitle>Historial de Cambios</DialogTitle>
					</div>
					<DialogDescription>
						{entityName
							? `Registro de todas las modificaciones realizadas a: ${entityName}`
							: "Registro de todas las modificaciones realizadas"}
					</DialogDescription>
				</DialogHeader>

				<div>
					{error ? (
						<div className="text-destructive rounded-md border border-red-200 bg-red-50 p-4 text-sm">
							{error}
						</div>
					) : (
						<AuditLogList
							logs={logs}
							maxHeight="500px"
							showEntity={false}
							createdBy={createdBy}
							isLoading={isLoading}
							emptyMessage="No se han registrado cambios para este elemento"
						/>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}
