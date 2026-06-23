"use client"

import { useMemo, useState } from "react"
import { Globe, Users } from "lucide-react"

import { useCustomersByNationality } from "../hooks/use-analytics"
import type { AnalyticsFilters } from "../actions/analytics.actions"

import { Map, MapClusterLayer, MapPopup, MapControls } from "@/shared/components/ui/map"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"

interface CustomersMapProps {
	filters: AnalyticsFilters
}

interface CustomerFeatureProperties {
	nationality: string
	count: number
	totalSpent: number
}

export function CustomersMap({ filters }: CustomersMapProps) {
	const { data: customerData, isLoading } = useCustomersByNationality(filters)
	const [selectedPoint, setSelectedPoint] = useState<{
		coordinates: [number, number]
		properties: CustomerFeatureProperties
	} | null>(null)

	const geojsonData = useMemo(() => {
		if (!customerData) return null

		const features: GeoJSON.Feature<GeoJSON.Point, CustomerFeatureProperties>[] = []

		customerData.forEach((item) => {
			if (!item.coordinates) return

			features.push({
				type: "Feature",
				properties: {
					nationality: item.nationality,
					count: item.count,
					totalSpent: item.totalSpent,
				},
				geometry: {
					type: "Point",
					coordinates: item.coordinates,
				},
			})
		})

		return {
			type: "FeatureCollection" as const,
			features,
		}
	}, [customerData])

	const formatCurrency = (value: number) =>
		new Intl.NumberFormat("es-CL", {
			style: "currency",
			currency: "CLP",
		}).format(value)

	const totalCustomers = customerData?.reduce((sum, d) => sum + d.count, 0) ?? 0
	const totalCountries = customerData?.length ?? 0

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-4 w-32" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-[400px] w-full" />
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Globe className="h-5 w-5" />
					Origen de Clientes
				</CardTitle>
				<CardDescription className="flex items-center gap-4">
					<span className="flex items-center gap-1">
						<Users className="h-4 w-4" />
						{totalCustomers.toLocaleString()} clientes
					</span>
					<span>•</span>
					<span>{totalCountries} países</span>
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="h-[400px] w-full overflow-hidden rounded-lg border">
					{geojsonData && geojsonData.features.length > 0 ? (
						<Map center={[-70, -20]} zoom={2} fadeDuration={0}>
							<MapClusterLayer<CustomerFeatureProperties>
								data={geojsonData}
								clusterRadius={60}
								clusterMaxZoom={12}
								clusterColors={["#22c55e", "#eab308", "#ef4444"]}
								clusterThresholds={[10, 50]}
								pointColor="#3b82f6"
								onPointClick={(feature, coordinates) => {
									setSelectedPoint({
										coordinates,
										properties: feature.properties,
									})
								}}
							/>

							{selectedPoint && (
								<MapPopup
									key={`${selectedPoint.coordinates[0]}-${selectedPoint.coordinates[1]}`}
									longitude={selectedPoint.coordinates[0]}
									latitude={selectedPoint.coordinates[1]}
									onClose={() => setSelectedPoint(null)}
									closeOnClick={false}
									focusAfterOpen={false}
									closeButton
								>
									<div className="min-w-[150px] space-y-2">
										<p className="text-sm font-semibold">{selectedPoint.properties.nationality}</p>
										<div className="space-y-1 text-xs">
											<p className="flex justify-between">
												<span className="text-muted-foreground">Clientes:</span>
												<span className="font-medium">
													{selectedPoint.properties.count.toLocaleString()}
												</span>
											</p>
											<p className="flex justify-between">
												<span className="text-muted-foreground">Gasto total:</span>
												<span className="font-medium">
													{formatCurrency(selectedPoint.properties.totalSpent)}
												</span>
											</p>
										</div>
									</div>
								</MapPopup>
							)}

							<MapControls position="bottom-right" />
						</Map>
					) : (
						<div className="text-muted-foreground flex h-full items-center justify-center">
							No hay datos de ubicación disponibles
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	)
}
