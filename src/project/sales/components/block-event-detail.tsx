"use client"

import { Label } from "@/shared/components/ui/label"
import { Textarea } from "@/shared/components/ui/textarea"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select"
import { Calendar } from "@/shared/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import { Button } from "@/shared/components/ui/button"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface Block2Props {
	formData: {
		modoVenta: string
		fechaEvento: Date | undefined
		tourEvento: string
		comentariosEvento: string
	}
	onChange: (field: string, value: string | Date | undefined) => void
	errors: Record<string, string>
}

// Datos de ejemplo - en producción vendrían de la base de datos
const toursRegulares = [
	{ id: "1", nombre: "City Tour Santiago", precio: 45000 },
	{ id: "2", nombre: "Valle del Maipo", precio: 65000 },
	{ id: "3", nombre: "Valparaíso y Viña del Mar", precio: 55000 },
	{ id: "4", nombre: "Cajón del Maipo", precio: 70000 },
]

const toursPrivados = [
	{ id: "p1", nombre: "Tour Privado Santiago", precioBase: 120000 },
	{ id: "p2", nombre: "Tour Privado Viñedos", precioBase: 180000 },
	{ id: "p3", nombre: "Tour Privado Valparaíso", precioBase: 150000 },
	{ id: "p4", nombre: "Tour Privado Andes", precioBase: 200000 },
]

export function Block2EventDetail({ formData, onChange, errors }: Block2Props) {
	const today = new Date()
	today.setHours(0, 0, 0, 0)

	// Obtener lista de tours según el modo de venta
	const availableTours = formData.modoVenta === "Regular" ? toursRegulares : toursPrivados

	const handleModoVentaChange = (value: string) => {
		onChange("modoVenta", value)
		// Limpiar selección de tour cuando cambia el modo
		onChange("tourEvento", "")
	}

	return (
		<div className="space-y-6">
			<div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
				{/* Modo de Venta */}
				<div className="space-y-2">
					<Label htmlFor="modoVenta" className="text-foreground">
						Modo de Venta <span className="text-destructive">*</span>
					</Label>
					<Select value={formData.modoVenta} onValueChange={handleModoVentaChange}>
						<SelectTrigger
							id="modoVenta"
							className={`w-full ${errors.modoVenta ? "border-destructive" : ""}`}
						>
							<SelectValue placeholder="Seleccione modo de venta" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="Regular">Regular</SelectItem>
							<SelectItem value="Privado">Privado</SelectItem>
						</SelectContent>
					</Select>
					{errors.modoVenta && <p className="text-destructive text-sm">{errors.modoVenta}</p>}
				</div>

				{/* Fecha del Evento */}
				<div className="space-y-2">
					<Label htmlFor="fechaEvento" className="text-foreground">
						Fecha del Evento <span className="text-destructive">*</span>
					</Label>
					<Popover>
						<PopoverTrigger asChild>
							<Button
								id="fechaEvento"
								variant="outline"
								className={cn(
									"w-full justify-start text-left font-normal",
									!formData.fechaEvento && "text-muted-foreground",
									errors.fechaEvento && "border-destructive"
								)}
							>
								<CalendarIcon className="h-4 w-4" />
								{formData.fechaEvento
									? format(formData.fechaEvento, "PPP", { locale: es })
									: "Seleccione una fecha"}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="start">
							<Calendar
								mode="single"
								selected={formData.fechaEvento}
								onSelect={(date) => onChange("fechaEvento", date)}
								disabled={(date) => date < today}
								initialFocus
								locale={es}
							/>
						</PopoverContent>
					</Popover>
					{errors.fechaEvento && <p className="text-destructive text-sm">{errors.fechaEvento}</p>}
					<p className="text-muted-foreground text-xs">No se pueden seleccionar fechas pasadas</p>
				</div>

				{/* Tour / Evento */}
				<div className="space-y-2 md:col-span-2">
					<Label htmlFor="tourEvento" className="text-foreground">
						Tour / Evento <span className="text-destructive">*</span>
					</Label>
					<Select
						value={formData.tourEvento}
						onValueChange={(value) => onChange("tourEvento", value)}
						disabled={!formData.modoVenta}
					>
						<SelectTrigger
							id="tourEvento"
							className={`w-full ${errors.tourEvento ? "border-destructive" : ""}`}
							disabled={!formData.modoVenta}
						>
							<SelectValue
								placeholder={
									formData.modoVenta ? "Seleccione un tour" : "Primero seleccione modo de venta"
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{availableTours.map((tour) => (
								<SelectItem key={tour.id} value={tour.id}>
									{tour.nombre} -{" "}
									{"precio" in tour
										? `$${tour.precio.toLocaleString("es-CL")}`
										: `desde $${tour.precioBase.toLocaleString("es-CL")}`}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{errors.tourEvento && <p className="text-destructive text-sm">{errors.tourEvento}</p>}
					{!formData.modoVenta && (
						<p className="text-muted-foreground text-xs">
							Debe seleccionar un modo de venta primero
						</p>
					)}
				</div>
			</div>

			{/* Comentarios del Evento */}
			<div className="space-y-2">
				<Label htmlFor="comentariosEvento" className="text-foreground">
					Comentarios del Evento
				</Label>
				<Textarea
					id="comentariosEvento"
					value={formData.comentariosEvento}
					onChange={(e) => onChange("comentariosEvento", e.target.value)}
					placeholder="Ingrese comentarios adicionales sobre el evento (opcional)"
					rows={4}
					className="resize-none"
				/>
				<p className="text-muted-foreground text-xs">
					Campo opcional para detalles específicos del tour
				</p>
			</div>
		</div>
	)
}
