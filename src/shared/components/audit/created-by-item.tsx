"use client"

import { UserIcon, ClockIcon, FileTextIcon } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

import { Card, CardContent } from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"

interface CreatedByProps {
	createdBy: { name?: string; createdAt?: Date }
}

export function CreatedBy({ createdBy }: CreatedByProps) {
	console.log({ createdBy })
	const timeAgo = createdBy.createdAt
		? formatDistanceToNow(createdBy.createdAt, {
				addSuffix: true,
				locale: es,
			})
		: ""

	return (
		<Card className="overflow-hidden p-4">
			<CardContent className="px-0">
				<div className="flex items-start gap-3">
					<div className="mt-1">
						<FileTextIcon className="size-4" />
					</div>

					<div className="flex-1 space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="outline" className="text-xs">
								Creación
							</Badge>
						</div>

						<div className="text-muted-foreground flex items-center gap-4 text-xs">
							<div className="flex items-center gap-1">
								<UserIcon className="h-3 w-3" />
								<span>{createdBy.name}</span>
							</div>
							<div className="flex items-center gap-1">
								<ClockIcon className="h-3 w-3" />
								<span>{timeAgo}</span>
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
