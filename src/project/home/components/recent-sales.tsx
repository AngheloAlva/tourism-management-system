"use client"

import { useRecentSales } from "../hooks/use-home"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar"

export function RecentSales() {
	const { data: sales, isLoading } = useRecentSales()

	if (isLoading) {
		return (
			<Card className="col-span-4">
				<CardHeader>
					<div className="bg-muted mb-2 h-6 w-48 rounded" />
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{Array.from({ length: 3 }).map((_, i) => (
							<div key={i} className="flex items-center space-x-4">
								<div className="bg-muted h-10 w-10 rounded-full" />
								<div className="space-y-2">
									<div className="bg-muted h-4 w-32 rounded" />
									<div className="bg-muted h-3 w-24 rounded" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className="col-span-4">
			<CardHeader>
				<CardTitle>Últimas Ventas</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-8">
					{sales?.length === 0 ? (
						<p className="text-muted-foreground text-sm">No hay ventas recientes.</p>
					) : (
						sales?.map((sale) => (
							<div key={sale.id} className="flex items-center">
								<Avatar className="h-9 w-9">
									<AvatarImage src="/avatars/01.png" alt="Avatar" />
									<AvatarFallback>{sale.client.slice(0, 2).toUpperCase()}</AvatarFallback>
								</Avatar>
								<div className="ml-4 space-y-1">
									<p className="text-sm leading-none font-medium">{sale.client}</p>
									<p className="text-muted-foreground text-xs">Vendedor: {sale.seller}</p>
								</div>
								<div className="ml-auto font-medium">+${sale.total.toLocaleString()}</div>
							</div>
						))
					)}
				</div>
			</CardContent>
		</Card>
	)
}
