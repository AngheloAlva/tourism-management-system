"use client"

import { Loader2, AlertCircle, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { createTourColumns } from "@/project/tours/columns/tour.columns"
import {
	useTours,
	useDeleteTour,
	useToursSummary,
	useToggleTourStatus,
	useTransferServices,
	useUpdateTransferServicePricing,
} from "@/project/tours/hooks/use-tours"

import { ToursDataTable } from "@/project/tours/components/tours-data-table"
import { ToursInsights } from "@/project/tours/components/tours-insights"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { ModuleLoadingSkeleton } from "@/shared/components/ui/module-loading-skeleton"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/shared/components/ui/dialog"
import {
	AlertDialog,
	AlertDialogTitle,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogDescription,
} from "@/shared/components/ui/alert-dialog"

import type { Tour } from "@/generated/prisma/client"

export default function ToursPage() {
	const router = useRouter()
	const { data: tours, isLoading: toursLoading, error: toursError } = useTours()
	const { data: summary, isLoading: summaryLoading, error: summaryError } = useToursSummary()
	const deleteTour = useDeleteTour()
	const toggleTourStatus = useToggleTourStatus()
	const { data: transferServices, isLoading: transferServicesLoading } = useTransferServices()
	const updateTransferServicePricing = useUpdateTransferServicePricing()

	const [tourToDelete, setTourToDelete] = useState<string | null>(null)
	const [transferPricingDraft, setTransferPricingDraft] = useState<
		Record<string, { pricePerPassenger: number; receptionPricePerPassenger: number }>
	>({})

	const handleEdit = (tour: Tour) => {
		router.push(`/dashboard/tours/${tour.id}/editar`)
	}

	const handleDelete = (id: string) => {
		setTourToDelete(id)
	}

	const confirmDelete = async () => {
		if (tourToDelete) {
			await deleteTour.mutateAsync(tourToDelete)
			setTourToDelete(null)
		}
	}

	const handleToggleStatus = async (id: string, active: boolean) => {
		await toggleTourStatus.mutateAsync({ id, active })
	}

	const columns = createTourColumns({
		onEdit: handleEdit,
		onDelete: handleDelete,
		onToggleStatus: handleToggleStatus,
	})

	const getTransferDraft = (
		serviceId: string,
		field: "pricePerPassenger" | "receptionPricePerPassenger",
		fallback: number
	) => {
		return transferPricingDraft[serviceId]?.[field] ?? fallback
	}

	const setTransferDraft = (
		serviceId: string,
		field: "pricePerPassenger" | "receptionPricePerPassenger",
		value: number
	) => {
		setTransferPricingDraft((prev) => ({
			...prev,
			[serviceId]: {
				pricePerPassenger: prev[serviceId]?.pricePerPassenger ?? 0,
				receptionPricePerPassenger: prev[serviceId]?.receptionPricePerPassenger ?? 0,
				[field]: value,
			},
		}))
	}

	const handleSaveTransferPricing = async (
		serviceId: string,
		fallbackSalePrice: number,
		fallbackReceptionPrice: number
	) => {
		const draft = transferPricingDraft[serviceId]
		await updateTransferServicePricing.mutateAsync({
			id: serviceId,
			pricePerPassenger: draft?.pricePerPassenger ?? fallbackSalePrice,
			receptionPricePerPassenger: draft?.receptionPricePerPassenger ?? fallbackReceptionPrice,
		})
	}

	if (toursLoading || summaryLoading) {
		return (
			<ModuleLoadingSkeleton
				titleWidthClassName="w-[260px]"
				descriptionWidthClassName="w-[360px]"
			/>
		)
	}

	if (toursError || summaryError) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<div className="text-center">
					<AlertCircle className="text-destructive mx-auto h-8 w-8" />
					<p className="text-destructive mt-4">Error al cargar los datos</p>
					<p className="text-muted-foreground mt-2 text-sm">
						{toursError?.message || summaryError?.message}
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Gestión de Tours</h1>
					<p className="text-muted-foreground mt-1">Administra tours, paquetes y transfers</p>
				</div>
				<div className="flex items-center gap-2">
					<Dialog>
						<DialogTrigger asChild>
							<Button variant="outline">Tarifas Transfer</Button>
						</DialogTrigger>
						<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
							<DialogHeader>
								<DialogTitle>Tarifas de Transfer</DialogTitle>
								<DialogDescription>
									Ajusta tarifa de venta y recepción por pasajero para cada variante de transfer.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-6">
								{transferServicesLoading ? (
									<div className="text-muted-foreground flex items-center gap-2 text-sm">
										<Loader2 className="h-4 w-4 animate-spin" />
										Cargando servicios de transfer...
									</div>
								) : (
									(["IN", "OUT"] as const).map((direction) => {
										const services = transferServices?.filter(
											(s: { direction: string }) => s.direction === direction
										)
										if (!services?.length) return null
										return (
											<div key={direction} className="space-y-3">
												<h3 className="text-sm font-semibold tracking-wide uppercase">
													Transfer {direction}
												</h3>
												<div className="grid gap-4 md:grid-cols-2">
													{services.map(
														(service: {
															id: string
															name: string
															pricePerPassenger: number
															receptionPricePerPassenger: number
														}) => (
															<div
																key={service.id}
																className="bg-background/60 dark:bg-background/30 space-y-3 rounded-lg border p-4"
															>
																<p className="font-medium">{service.name}</p>
																<div className="grid gap-3">
																	<div className="space-y-1">
																		<p className="text-muted-foreground text-sm">
																			Tarifa venta por pasajero
																		</p>
																		<Input
																			type="number"
																			value={getTransferDraft(
																				service.id,
																				"pricePerPassenger",
																				service.pricePerPassenger
																			)}
																			onChange={(e) =>
																				setTransferDraft(
																					service.id,
																					"pricePerPassenger",
																					Number(e.target.value || 0)
																				)
																			}
																		/>
																	</div>
																	<div className="space-y-1">
																		<p className="text-muted-foreground text-sm">
																			Tarifa recepción por pasajero
																		</p>
																		<Input
																			type="number"
																			value={getTransferDraft(
																				service.id,
																				"receptionPricePerPassenger",
																				service.receptionPricePerPassenger
																			)}
																			onChange={(e) =>
																				setTransferDraft(
																					service.id,
																					"receptionPricePerPassenger",
																					Number(e.target.value || 0)
																				)
																			}
																		/>
																	</div>
																</div>
																<Button
																	onClick={() =>
																		handleSaveTransferPricing(
																			service.id,
																			service.pricePerPassenger,
																			service.receptionPricePerPassenger
																		)
																	}
																	disabled={updateTransferServicePricing.isPending}
																>
																	Guardar tarifas
																</Button>
															</div>
														)
													)}
												</div>
											</div>
										)
									})
								)}
							</div>
						</DialogContent>
					</Dialog>
					<Button onClick={() => router.push("/dashboard/tours/nuevo")} data-testid="tours-button-create">
						<Plus className="h-4 w-4" />
						Nuevo Tour
					</Button>
				</div>
			</div>

			{summary && <ToursInsights summary={summary} />}

			<section className="space-y-4">
				<div>
					<h2 className="text-lg font-semibold">Listado de Tours</h2>
					<p className="text-muted-foreground text-sm">
						Gestiona todos los tours, paquetes y transfers disponibles ({tours?.length || 0}{" "}
						registros)
					</p>
				</div>
				{tours && <ToursDataTable columns={columns} data={tours} />}
			</section>

			<AlertDialog open={!!tourToDelete} onOpenChange={() => setTourToDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
						<AlertDialogDescription>
							Esta acción no se puede deshacer. El tour será eliminado permanentemente de la base de
							datos.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmDelete}
							className="bg-destructive hover:bg-destructive/90 text-white"
						>
							Eliminar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
