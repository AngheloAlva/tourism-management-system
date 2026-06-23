import { ChevronLeft, ChevronRight, CheckSquare, FileDown, FileSpreadsheet } from "lucide-react"
import { es } from "date-fns/locale"
import { format, startOfWeek, endOfWeek } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/shared/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/shared/components/ui/toggle-group"
import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"

import { VIEW_MODE } from "../types/calendar.types"
import type { CalendarViewHeaderProps, ViewMode } from "../types/calendar.types"
import { Separator } from "@/shared/components/ui/separator"
import type { ExportScope } from "../utils/export-filters"
import type { ExportFormat } from "../utils/export-utils"
import { CalendarLegend } from "./calendar-legend"
import { useId } from "react"

function getTitle(viewMode: ViewMode, selectedDate: Date): string {
	switch (viewMode) {
		case VIEW_MODE.MONTH:
			return format(selectedDate, "MMMM yyyy", { locale: es })

		case VIEW_MODE.WEEK: {
			const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
			const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })
			const startStr = format(weekStart, "d", { locale: es })
			const endStr = format(weekEnd, "d MMM yyyy", { locale: es })
			return `${startStr} – ${endStr}`
		}

		case VIEW_MODE.DAY:
			return format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })

		case VIEW_MODE.PROVIDER: {
			const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
			const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })
			const startStr = format(weekStart, "d", { locale: es })
			const endStr = format(weekEnd, "d MMM yyyy", { locale: es })
			return `Semana del ${startStr} al ${endStr}`
		}
	}
}

interface CalendarViewHeaderWithSelectionProps extends CalendarViewHeaderProps {
	isSelectionMode?: boolean
	onToggleSelectionMode?: () => void
	onExport?: (scope: ExportScope, format: ExportFormat) => Promise<void>
	toursForDay?: Array<{ id: string; name: string }>
	onAutoAssign?: () => void
	hasUnassignedEvents?: boolean
}

export function CalendarViewHeader({
	viewMode,
	selectedDate,
	onPrev,
	onNext,
	onToday,
	onViewModeChange,
	isSelectionMode,
	onToggleSelectionMode,
	onExport,
	toursForDay = [],
	onAutoAssign,
	hasUnassignedEvents = false,
	grouped = true,
	onGroupedChange,
}: CalendarViewHeaderWithSelectionProps) {
	const title = getTitle(viewMode, selectedDate)
	const supportsSelection =
		viewMode === VIEW_MODE.DAY || viewMode === VIEW_MODE.WEEK || viewMode === VIEW_MODE.MONTH
	const groupedSwitchId = useId()

	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<h2 className="text-2xl font-bold capitalize">{title}</h2>

			<div className="flex items-center gap-2">
				<CalendarLegend />
				{onExport && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" className="gap-1.5" aria-label="Exportar datos">
								<FileDown className="h-4 w-4" />
								Exportar
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-52">
							{/* Group: Día actual */}
							<DropdownMenuLabel>Día actual</DropdownMenuLabel>
							<DropdownMenuItem
								onClick={() => onExport({ kind: "day", date: selectedDate }, "pdf")}
							>
								<FileDown className="h-4 w-4" />
								PDF
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => onExport({ kind: "day", date: selectedDate }, "xlsx")}
							>
								<FileSpreadsheet className="h-4 w-4" />
								Excel
							</DropdownMenuItem>

							{/* Group: Por tour */}
							{toursForDay.length > 0 && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuLabel>Por tour</DropdownMenuLabel>
									{toursForDay.map((tour) => (
										<DropdownMenuSub key={tour.id}>
											<DropdownMenuSubTrigger>{tour.name}</DropdownMenuSubTrigger>
											<DropdownMenuSubContent>
												<DropdownMenuItem
													onClick={() =>
														onExport(
															{ kind: "tour", tourName: tour.name, date: selectedDate },
															"pdf"
														)
													}
												>
													<FileDown className="h-4 w-4" />
													PDF
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() =>
														onExport(
															{ kind: "tour", tourName: tour.name, date: selectedDate },
															"xlsx"
														)
													}
												>
													<FileSpreadsheet className="h-4 w-4" />
													Excel
												</DropdownMenuItem>
											</DropdownMenuSubContent>
										</DropdownMenuSub>
									))}
								</>
							)}

							{/* Group: Por tipo de proveedor */}
							<DropdownMenuSeparator />
							<DropdownMenuLabel>Por tipo de proveedor</DropdownMenuLabel>

							<DropdownMenuSub>
								<DropdownMenuSubTrigger>Guías</DropdownMenuSubTrigger>
								<DropdownMenuSubContent>
									<DropdownMenuItem
										onClick={() =>
											onExport(
												{ kind: "provider-type", providerType: "guide", date: selectedDate },
												"pdf"
											)
										}
									>
										<FileDown className="h-4 w-4" />
										PDF
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() =>
											onExport(
												{ kind: "provider-type", providerType: "guide", date: selectedDate },
												"xlsx"
											)
										}
									>
										<FileSpreadsheet className="h-4 w-4" />
										Excel
									</DropdownMenuItem>
								</DropdownMenuSubContent>
							</DropdownMenuSub>

							<DropdownMenuSub>
								<DropdownMenuSubTrigger>Conductores</DropdownMenuSubTrigger>
								<DropdownMenuSubContent>
									<DropdownMenuItem
										onClick={() =>
											onExport(
												{ kind: "provider-type", providerType: "driver", date: selectedDate },
												"pdf"
											)
										}
									>
										<FileDown className="h-4 w-4" />
										PDF
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() =>
											onExport(
												{ kind: "provider-type", providerType: "driver", date: selectedDate },
												"xlsx"
											)
										}
									>
										<FileSpreadsheet className="h-4 w-4" />
										Excel
									</DropdownMenuItem>
								</DropdownMenuSubContent>
							</DropdownMenuSub>

							<DropdownMenuSub>
								<DropdownMenuSubTrigger>Vehículos</DropdownMenuSubTrigger>
								<DropdownMenuSubContent>
									<DropdownMenuItem
										onClick={() =>
											onExport(
												{ kind: "provider-type", providerType: "vehicle", date: selectedDate },
												"pdf"
											)
										}
									>
										<FileDown className="h-4 w-4" />
										PDF
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() =>
											onExport(
												{ kind: "provider-type", providerType: "vehicle", date: selectedDate },
												"xlsx"
											)
										}
									>
										<FileSpreadsheet className="h-4 w-4" />
										Excel
									</DropdownMenuItem>
								</DropdownMenuSubContent>
							</DropdownMenuSub>
						</DropdownMenuContent>
					</DropdownMenu>
				)}

				{supportsSelection && onToggleSelectionMode && (
					<Button
						variant={isSelectionMode ? "default" : "outline"}
						onClick={onToggleSelectionMode}
						className={cn(
							"gap-1.5",
							isSelectionMode &&
								"bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
						)}
					>
						<CheckSquare className="h-4 w-4" />
						Seleccionar
					</Button>
				)}

				<div className="flex items-center space-x-1">
					<Button variant="outline" size="icon" onClick={onPrev}>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<Button variant="outline" size="icon" onClick={onNext}>
						<ChevronRight className="h-4 w-4" />
					</Button>
					<Button variant="outline" onClick={onToday}>
						Hoy
					</Button>
				</div>

				<Separator orientation="vertical" className="mx-2" />

				{onGroupedChange && (
					<div className="flex items-center gap-1.5">
						<Switch
							id={groupedSwitchId}
							data-testid="grouped-toggle-switch"
							size="sm"
							checked={grouped}
							onCheckedChange={onGroupedChange}
						/>
						<Label htmlFor={groupedSwitchId} className="cursor-pointer text-sm whitespace-nowrap">
							Agrupado
						</Label>
					</div>
				)}

				<ToggleGroup
					size="sm"
					type="single"
					value={viewMode}
					variant="outline"
					onValueChange={(value) => {
						if (value) onViewModeChange(value as ViewMode)
					}}
				>
					<ToggleGroupItem value={VIEW_MODE.DAY}>Día</ToggleGroupItem>
					<ToggleGroupItem value={VIEW_MODE.WEEK}>Semana</ToggleGroupItem>
					<ToggleGroupItem value={VIEW_MODE.MONTH}>Mes</ToggleGroupItem>
					<ToggleGroupItem value={VIEW_MODE.PROVIDER}>Proveedores</ToggleGroupItem>
				</ToggleGroup>
			</div>
		</div>
	)
}
