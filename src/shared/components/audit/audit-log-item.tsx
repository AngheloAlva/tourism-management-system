"use client"

import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { useState } from "react"
import {
	EditIcon,
	UserIcon,
	ClockIcon,
	Trash2Icon,
	FileTextIcon,
	ChevronUpIcon,
	ChevronDownIcon,
} from "lucide-react"

import { Card, CardContent } from "@/shared/components/ui/card"
import { Separator } from "@/shared/components/ui/separator"
import { Badge } from "@/shared/components/ui/badge"

import type { AuditLog } from "@/generated/prisma/client"

interface AuditLogItemProps {
	log: AuditLog
	showEntity?: boolean
}

export function AuditLogItem({ log, showEntity = false }: AuditLogItemProps) {
	const [showDetails, setShowDetails] = useState(false)

	const getActionIcon = () => {
		switch (log.action) {
			case "CREATE":
				return <FileTextIcon className="h-4 w-4 text-green-500" />
			case "UPDATE":
				return <EditIcon className="h-4 w-4 text-blue-500" />
			case "DELETE":
				return <Trash2Icon className="h-4 w-4 text-red-500" />
			default:
				return <FileTextIcon className="h-4 w-4" />
		}
	}

	const getActionBadge = () => {
		const variants = {
			CREATE: "default" as const,
			UPDATE: "secondary" as const,
			DELETE: "destructive" as const,
		}

		const labels = {
			CREATE: "Creado",
			UPDATE: "Modificado",
			DELETE: "Eliminado",
		}

		return <Badge variant={variants[log.action]}>{labels[log.action]}</Badge>
	}

	const renderChanges = () => {
		if (!log.changes || typeof log.changes !== "object") {
			return null
		}

		const changes = log.changes as Record<string, { old: string; new: string }>
		const entries = Object.entries(changes)

		if (entries.length === 0) return null

		return (
			<div className="mt-3 space-y-2">
				<p className="text-muted-foreground text-sm font-medium">Cambios realizados:</p>
				<div className="space-y-2">
					{entries.map(([field, change]) => (
						<div key={field} className="bg-muted/50 flex flex-col space-y-1 rounded-md p-2 text-sm">
							<span className="font-medium capitalize">
								{field.replace(/([A-Z])/g, " $1").trim()}:
							</span>
							<div className="flex items-center gap-2 text-xs">
								<span className="text-red-600 line-through">{formatValue(change.old)}</span>
								<span className="text-muted-foreground">→</span>
								<span className="font-medium text-green-600">{formatValue(change.new)}</span>
							</div>
						</div>
					))}
				</div>
			</div>
		)
	}

	const formatValue = (value: string): string => {
		if (value === null || value === undefined) return "(vacío)"
		if (typeof value === "boolean") return value ? "Sí" : "No"
		if (typeof value === "object") return JSON.stringify(value)
		return String(value)
	}

	const timeAgo = formatDistanceToNow(new Date(log.createdAt), {
		addSuffix: true,
		locale: es,
	})

	return (
		<Card className="overflow-hidden p-4">
			<CardContent className="px-0">
				<div className="flex items-start gap-3">
					<div className="mt-1">{getActionIcon()}</div>

					<div className="flex-1 space-y-2">
						<div className="flex items-start justify-between gap-2">
							<div className="flex-1">
								<div className="flex flex-wrap items-center gap-2">
									{getActionBadge()}
									{showEntity && (
										<Badge variant="outline" className="text-xs">
											{log.entityType}
										</Badge>
									)}
								</div>
								<p className="mt-1.5 text-sm">{log.description || "Sin descripción"}</p>
							</div>

							{log.changes && Object.keys(log.changes as object).length > 0 && (
								<button
									onClick={() => setShowDetails(!showDetails)}
									className="text-muted-foreground hover:text-foreground transition-colors"
								>
									{showDetails ? (
										<ChevronUpIcon className="h-4 w-4" />
									) : (
										<ChevronDownIcon className="h-4 w-4" />
									)}
								</button>
							)}
						</div>

						<div className="text-muted-foreground flex items-center gap-4 text-xs">
							<div className="flex items-center gap-1">
								<UserIcon className="h-3 w-3" />
								<span>{log.userName}</span>
							</div>
							<div className="flex items-center gap-1">
								<ClockIcon className="h-3 w-3" />
								<span>{timeAgo}</span>
							</div>
						</div>

						{showDetails && (
							<>
								<Separator className="my-2" />
								{renderChanges()}
							</>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
