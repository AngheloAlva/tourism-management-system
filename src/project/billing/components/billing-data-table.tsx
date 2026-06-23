"use client"

import { es } from "date-fns/locale"
import { format } from "date-fns"

import { useRecentSales } from "../hooks/use-billing"

import { ScrollArea } from "@/shared/components/ui/scroll-area"
import { Badge } from "@/shared/components/ui/badge"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"
import {
	Table,
	TableRow,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
} from "@/shared/components/ui/table"

import type { BillingFilters } from "../actions/billing.actions"

interface BillingDataTableProps {
	filters?: BillingFilters
}

const channelColors: Record<string, string> = {
	ONLINE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	AGENCY: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	PHYSICAL: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	WHOLESALE: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
}

const channelLabels: Record<string, string> = {
	ONLINE: "Online",
	AGENCY: "Agencia",
	PHYSICAL: "Presencial",
	WHOLESALE: "Mayorista",
}

export function BillingDataTable({ filters }: BillingDataTableProps) {
	const { data: sales, isLoading } = useRecentSales(filters, 50)

	const formatCurrency = (amount: number) =>
		new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(amount)

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Ventas Recientes</CardTitle>
					<CardDescription>Cargando...</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{Array.from({ length: 5 }).map((_, i) => (
							<div key={i} className="bg-muted h-12 animate-pulse rounded" />
						))}
					</div>
				</CardContent>
			</Card>
		)
	}

	if (!sales || sales.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Ventas Recientes</CardTitle>
					<CardDescription>Historial de ventas</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
						No hay ventas en el período seleccionado
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Ventas Recientes</CardTitle>
				<CardDescription>Mostrando {sales.length} ventas más recientes</CardDescription>
			</CardHeader>
			<CardContent>
				<ScrollArea className="h-[400px]">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-[80px]">Voucher</TableHead>
								<TableHead>Fecha</TableHead>
								<TableHead>Vendedor</TableHead>
								<TableHead>Canal</TableHead>
								<TableHead>Tours</TableHead>
								<TableHead className="text-center">Pax</TableHead>
								<TableHead className="text-right">Monto</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{sales.map((sale) => (
								<TableRow key={sale.id}>
									<TableCell className="font-mono font-semibold">V-{sale.voucher}</TableCell>
									<TableCell className="text-muted-foreground">
										{format(new Date(sale.date), "dd/MM/yyyy", { locale: es })}
									</TableCell>
									<TableCell>{sale.seller}</TableCell>
									<TableCell>
										<Badge variant="outline" className={channelColors[sale.channel]}>
											{channelLabels[sale.channel] || sale.channel}
										</Badge>
									</TableCell>
									<TableCell className="max-w-[200px] truncate" title={sale.tours}>
										{sale.tours || "-"}
									</TableCell>
									<TableCell className="text-center">{sale.passengers}</TableCell>
									<TableCell className="text-right font-medium">
										{formatCurrency(sale.revenue)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</ScrollArea>
			</CardContent>
		</Card>
	)
}
