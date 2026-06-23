import { Badge } from "@/shared/components/ui/badge"
import { Clock, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

type PaymentStatus = "PENDING" | "ENTRANCE_ONLY" | "TOUR_ONLY" | "FULLY_PAID"

interface PaymentStatusBadgeProps {
	status: PaymentStatus
	showIcon?: boolean
	className?: string
	simplified?: boolean // Para mostrar versión simplificada en tablas
}

const statusConfig = {
	PENDING: {
		color: "bg-yellow-500/20 text-yellow-500",
		icon: Clock,
		label: "Pendiente",
		simplifiedLabel: "Pendiente",
	},
	ENTRANCE_ONLY: {
		color: "bg-yellow-500/20 text-yellow-500",
		icon: Clock,
		label: "Pago Solo Entrada",
		simplifiedLabel: "Pendiente",
	},
	TOUR_ONLY: {
		color: "bg-yellow-500/20 text-yellow-500",
		icon: Clock,
		label: "Pago Solo Tour",
		simplifiedLabel: "Pendiente",
	},
	FULLY_PAID: {
		color: "bg-green-500/20 text-green-500",
		icon: CheckCircle2,
		label: "Completo",
		simplifiedLabel: "Completo",
	},
} as const

export function PaymentStatusBadge({
	status,
	showIcon = true,
	className,
	simplified = false,
}: PaymentStatusBadgeProps) {
	const config = statusConfig[status]
	const Icon = config.icon
	const label = simplified ? config.simplifiedLabel : config.label

	return (
		<Badge variant="outline" className={cn("font-medium", config.color, className)}>
			{showIcon && <Icon className="mr-1 h-3 w-3" />}
			{label}
		</Badge>
	)
}
