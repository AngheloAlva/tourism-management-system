"use client"

import { Users, HelpCircle, Ban } from "lucide-react"

import { Button } from "@/shared/components/ui/button"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/shared/components/ui/popover"

type LegendRow = {
	icon: React.ReactNode
	label: string
	description: string
}

function MissingAssignmentDot({ letter }: { letter: string }) {
	return (
		<span className="inline-flex size-5 items-center justify-center rounded-full bg-red-500/20 text-[10px] font-bold text-red-700 dark:bg-red-500/30 dark:text-red-300">
			{letter}
		</span>
	)
}

function TransferBadge() {
	return (
		<span className="inline-flex size-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
			T
		</span>
	)
}

function IncompletePassengersIcon() {
	return (
		<span className="inline-flex size-5 items-center justify-center rounded-full bg-amber-500/80">
			<Users className="size-3 text-white" />
		</span>
	)
}

function ConflictIcon() {
	return (
		<span className="inline-flex size-5 items-center justify-center">
			<Ban className="size-4 text-red-600 dark:text-red-400" />
		</span>
	)
}

const rows: LegendRow[] = [
	{
		icon: <MissingAssignmentDot letter="G" />,
		label: "Guía faltante",
		description: "El evento aún no tiene guía asignado.",
	},
	{
		icon: <MissingAssignmentDot letter="C" />,
		label: "Conductor faltante",
		description: "El evento aún no tiene conductor asignado.",
	},
	{
		icon: <MissingAssignmentDot letter="V" />,
		label: "Vehículo faltante",
		description: "El evento aún no tiene vehículo asignado.",
	},
	{
		icon: <TransferBadge />,
		label: "Transfers",
		description: "Este evento tiene uno o más transfers asociados.",
	},
	{
		icon: <IncompletePassengersIcon />,
		label: "Pasajeros incompletos",
		description: "Hay pasajeros con datos faltantes (nombre, documento, etc.).",
	},
	{
		icon: <ConflictIcon />,
		label: "Conflicto de proveedor",
		description: "El proveedor asignado tiene otro evento en conflicto.",
	},
]

export function CalendarLegend() {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					aria-label="Ver leyenda de iconos"
					title="Leyenda"
				>
					<HelpCircle className="h-4 w-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80">
				<div className="space-y-3">
					<div>
						<h4 className="text-sm font-semibold">Leyenda</h4>
						<p className="text-xs text-muted-foreground">
							Significado de los iconos en los eventos.
						</p>
					</div>
					<ul className="space-y-2.5">
						{rows.map((row) => (
							<li key={row.label} className="flex items-start gap-3">
								<div className="mt-0.5 flex w-16 shrink-0 items-center justify-start">
									{row.icon}
								</div>
								<div className="flex-1">
									<p className="text-sm font-medium">{row.label}</p>
									<p className="text-xs text-muted-foreground">{row.description}</p>
								</div>
							</li>
						))}
					</ul>
				</div>
			</PopoverContent>
		</Popover>
	)
}
