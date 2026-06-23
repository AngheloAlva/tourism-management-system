"use client"

import { HistoryIcon } from "lucide-react"

import type { AuditLog } from "@/generated/prisma/client"
import { AuditLogItem } from "./audit-log-item"
import { Alert, AlertDescription } from "@/shared/components/ui/alert"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { CreatedBy } from "./created-by-item"

interface AuditLogListProps {
	logs: AuditLog[]
	isLoading?: boolean
	showEntity?: boolean
	emptyMessage?: string
	maxHeight?: string
	createdBy?: { name?: string; createdAt?: Date }
}

export function AuditLogList({
	logs,
	createdBy,
	isLoading = false,
	showEntity = false,
	maxHeight = "600px",
	emptyMessage = "No hay registros de cambios disponibles",
}: AuditLogListProps) {
	if (isLoading) {
		return (
			<div className="space-y-3">
				{[...Array(3)].map((_, i) => (
					<Skeleton key={i} className="h-24 w-full" />
				))}
			</div>
		)
	}

	if (logs.length === 0) {
		return (
			<Alert>
				<HistoryIcon className="h-4 w-4" />
				<AlertDescription>{emptyMessage}</AlertDescription>
			</Alert>
		)
	}

	return (
		<div style={{ maxHeight }} className="overflow-y-auto">
			<div className="space-y-3">
				{logs.map((log) => (
					<AuditLogItem key={log.id} log={log} showEntity={showEntity} />
				))}

				{createdBy && <CreatedBy createdBy={createdBy} />}
			</div>
		</div>
	)
}
