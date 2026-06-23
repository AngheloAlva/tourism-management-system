"use client"

import { useQuery } from "@tanstack/react-query"
import { History, Loader2, ChevronDown, ArrowRightLeft } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Badge } from "@/shared/components/ui/badge"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/shared/components/ui/collapsible"

import { getEventAuditLog } from "@/project/events/actions/audit.actions"
import type { AuditLogEntry } from "@/project/events/actions/audit.actions"

interface EventAuditLogSectionProps {
	eventId: string
}

export function EventAuditLogSection({ eventId }: EventAuditLogSectionProps) {
	const { data: entries, isLoading } = useQuery({
		queryKey: ["event-audit-log", eventId],
		queryFn: () => getEventAuditLog(eventId),
		enabled: !!eventId,
	})

	return (
		<Collapsible defaultOpen={false}>
			<div className="rounded-lg border">
				<CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between p-3">
					<div className="flex items-center gap-2">
						<History className="h-4 w-4 text-slate-600 dark:text-slate-400" />
						<span className="font-medium">Historial de cambios</span>
						{entries && entries.length > 0 && (
							<span className="text-muted-foreground text-xs">
								({entries.length})
							</span>
						)}
					</div>
					<ChevronDown className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-180" />
				</CollapsibleTrigger>
				<CollapsibleContent>
					<div className="border-t p-3">
						{isLoading ? (
							<div className="flex items-center justify-center py-4">
								<Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
							</div>
						) : !entries || entries.length === 0 ? (
							<p className="text-muted-foreground py-2 text-center text-xs">
								Sin cambios registrados
							</p>
						) : (
							<ul className="space-y-2">
								{entries.map((entry) => (
									<AuditLogItem key={entry.id} entry={entry} />
								))}
							</ul>
						)}
					</div>
				</CollapsibleContent>
			</div>
		</Collapsible>
	)
}

// --- Helpers ---

function isBookingMoveEntry(entry: AuditLogEntry): boolean {
	return (entry.metadata as Record<string, unknown> | null)?.type === "BOOKING_MOVE"
}

function getBookingMoveDirection(entry: AuditLogEntry): "IN" | "OUT" | null {
	if (!isBookingMoveEntry(entry)) return null
	const direction = (entry.metadata as Record<string, unknown> | null)?.direction
	return direction === "IN" || direction === "OUT" ? direction : null
}

// --- AuditLogItem ---

function AuditLogItem({ entry }: { entry: AuditLogEntry }) {
	const formattedDate = format(new Date(entry.createdAt), "d MMM yyyy, HH:mm", {
		locale: es,
	})

	const isMove = isBookingMoveEntry(entry)
	const direction = getBookingMoveDirection(entry)

	return (
		<li
			className={cn(
				"flex flex-col gap-0.5 rounded-md px-2 py-1.5",
				isMove
					? direction === "IN"
						? "bg-blue-50/50 dark:bg-blue-500/5"
						: "bg-amber-50/50 dark:bg-amber-500/5"
					: "bg-muted/30"
			)}
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-1.5">
					<span className="text-muted-foreground text-[10px]">{formattedDate}</span>
					{isMove && (
						<Badge
							variant="outline"
							className={cn(
								"gap-0.5 px-1 py-0 text-[9px]",
								direction === "IN"
									? "border-blue-300 text-blue-700 dark:border-blue-500/40 dark:text-blue-300"
									: "border-amber-300 text-amber-700 dark:border-amber-500/40 dark:text-amber-300"
							)}
						>
							<ArrowRightLeft className="h-2.5 w-2.5" />
							{direction === "IN" ? "Recibido" : "Enviado"}
						</Badge>
					)}
				</div>
				<span className="text-muted-foreground truncate text-[10px]">
					{entry.userName}
				</span>
			</div>
			{entry.description && (
				<p className="text-xs">{entry.description}</p>
			)}
		</li>
	)
}
