"use client"

import { CalendarIcon } from "lucide-react"
import { useState } from "react"
import { es } from "date-fns/locale"
import { format } from "date-fns"

import { cn } from "@/lib/utils"

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import { EventDetailPanel } from "@/project/calendar/components/event-detail-panel"
import { SaleDetailSheet } from "@/project/sales/components/sale-detail-sheet"
import { useSaleRecord } from "@/project/sales/hooks/use-sale-records"
import { useDepartureEvents } from "../hooks/use-departure-events"
import { Calendar } from "@/shared/components/ui/calendar"
import { TableFilterDropdown } from "@/shared/components/ui/table-filter-dropdown"
import { ModuleLoadingSkeleton } from "@/shared/components/ui/module-loading-skeleton"
import { Button } from "@/shared/components/ui/button"
import { DeparturesInsights } from "./departures-insights"
import { SalesTable } from "./sales-table"
import { EventList } from "./event-list"

export function DeparturesView() {
	const [selectedDate, setSelectedDate] = useState<Date>(new Date())
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
	const [editingEventId, setEditingEventId] = useState<string | null>(null)
	const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
	const [isSheetOpen, setIsSheetOpen] = useState(false)
	const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
	const [serviceKindFilter, setServiceKindFilter] = useState<string>("all")
	const [modeFilter, setModeFilter] = useState<string>("all")
	const [statusFilter, setStatusFilter] = useState<string>("all")

	const { data: events, isLoading: isLoadingEvents, refetch } = useDepartureEvents(selectedDate)
	const { data: saleDetail } = useSaleRecord(selectedSaleId || "")

	const allEvents = events || []
	const statusOptions = Array.from(new Set(allEvents.map((event) => event.status))).sort()

	const filteredEvents = allEvents.filter((event) => {
		if (serviceKindFilter !== "all" && event.serviceKind !== serviceKindFilter) {
			return false
		}

		if (modeFilter !== "all" && event.mode !== modeFilter) {
			return false
		}

		if (statusFilter !== "all" && event.status !== statusFilter) {
			return false
		}

		return true
	})

	const selectedEvent = filteredEvents.find((event) => event.id === selectedEventId) || null
	const hasActiveNonDateFilters =
		serviceKindFilter !== "all" || modeFilter !== "all" || statusFilter !== "all"

	const filterGroups = [
		{
			key: "serviceKind",
			label: "Servicio",
			value: serviceKindFilter,
			allLabel: "Todos los servicios",
			options: [
				{ label: "Tours", value: "TOUR" },
				{ label: "Transfers", value: "TRANSFER" },
			],
			onChange: (value: string) => setServiceKindFilter(value),
		},
		{
			key: "mode",
			label: "Modalidad",
			value: modeFilter,
			allLabel: "Todas las modalidades",
			options: [
				{ label: "Privado", value: "PRIVATE" },
				{ label: "Regular", value: "REGULAR" },
			],
			onChange: (value: string) => setModeFilter(value),
		},
		{
			key: "status",
			label: "Estado",
			value: statusFilter,
			allLabel: "Todos los estados",
			options: statusOptions.map((status) => ({
				label: status,
				value: status,
			})),
			onChange: (value: string) => setStatusFilter(value),
		},
	]

	const handleSelectSale = (saleId: string) => {
		setSelectedSaleId(saleId)
		setIsSheetOpen(true)
	}

	const handleCloseSheet = () => {
		setIsSheetOpen(false)
		setTimeout(() => setSelectedSaleId(null), 300)
	}

	const handleEditEvent = (eventId: string) => {
		setEditingEventId(eventId)
		setIsEventDialogOpen(true)
	}

	const handleCloseEventDialog = () => {
		setIsEventDialogOpen(false)
		setTimeout(() => setEditingEventId(null), 300)
		refetch()
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Control de Salidas</h1>
					<p className="text-muted-foreground mt-1">Gestiona los eventos y ventas del día</p>
				</div>

				<div className="flex flex-wrap items-center justify-end gap-2">
					<TableFilterDropdown
						groups={filterGroups}
						onClearAll={() => {
							setServiceKindFilter("all")
							setModeFilter("all")
							setStatusFilter("all")
						}}
					/>
					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								className={cn(
									"justify-start text-left font-normal",
									!selectedDate && "text-muted-foreground"
								)}
							>
								<CalendarIcon className="h-4 w-4" />
								{selectedDate ? (
									format(selectedDate, "PPP", { locale: es })
								) : (
									<span>Selecciona una fecha</span>
								)}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0">
							<Calendar
								mode="single"
								selected={selectedDate}
								onSelect={(date) => {
									if (date) {
										setSelectedDate(date)
										setSelectedEventId(null)
									}
								}}
								locale={es}
							/>
						</PopoverContent>
					</Popover>
					{hasActiveNonDateFilters ? (
						<Button
							variant="outline"
							onClick={() => {
								setServiceKindFilter("all")
								setModeFilter("all")
								setStatusFilter("all")
							}}
						>
							Limpiar
						</Button>
					) : null}
				</div>
			</div>

			<DeparturesInsights events={filteredEvents} />

			{isLoadingEvents ? (
				<ModuleLoadingSkeleton
					titleWidthClassName="w-[280px]"
					descriptionWidthClassName="w-[360px]"
				/>
			) : (
				<div className="grid gap-4 lg:grid-cols-12">
					<div className="lg:col-span-4">
						<div className="h-[calc(100vh-220px)] min-h-[500px]">
							<EventList
								events={filteredEvents}
								selectedDate={selectedDate}
								selectedEventId={selectedEventId}
								onSelectEvent={setSelectedEventId}
								onEditEvent={handleEditEvent}
							/>
						</div>
					</div>

					<div className="lg:col-span-8">
						<div className="h-[calc(100vh-220px)] min-h-[500px]">
							<SalesTable selectedEvent={selectedEvent} onSelectSale={handleSelectSale} />
						</div>
					</div>
				</div>
			)}

			<SaleDetailSheet
				open={isSheetOpen}
				sale={saleDetail || null}
				onOpenChange={handleCloseSheet}
			/>

			<EventDetailPanel
				eventId={editingEventId}
				open={isEventDialogOpen}
				onClose={handleCloseEventDialog}
			/>
		</div>
	)
}
