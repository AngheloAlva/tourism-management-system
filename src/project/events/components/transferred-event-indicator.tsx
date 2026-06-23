"use client"

import { Badge } from "@/shared/components/ui/badge"
import { ArrowRightLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface TransferredEventIndicatorProps {
	agencyName: string
	transferDate?: Date
	executiveName?: string
	className?: string
}

export function TransferredEventIndicator({
	agencyName,
	transferDate,
	executiveName,
	className,
}: TransferredEventIndicatorProps) {
	return (
		<div className={cn("flex items-center gap-2 text-sm", className)}>
			<Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-700">
				<ArrowRightLeft className="mr-1 h-3 w-3" />
				Traspasado
			</Badge>
			<div className="text-muted-foreground">
				a <span className="text-foreground font-medium">{agencyName}</span>
				{transferDate && (
					<span className="ml-1">({new Date(transferDate).toLocaleDateString()})</span>
				)}
				{executiveName && <span className="ml-1 text-xs">por {executiveName}</span>}
			</div>
		</div>
	)
}
