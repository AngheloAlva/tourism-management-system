"use client"

import { Users, X, FileDown, FileSpreadsheet } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/shared/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import type { ExportFormat } from "../utils/export-utils"

interface SelectionActionBarProps {
	selectedCount: number
	onAssign: () => void
	onClearSelection: () => void
	onExportSelection?: (format: ExportFormat) => Promise<void>
}

export function SelectionActionBar({
	selectedCount,
	onAssign,
	onClearSelection,
	onExportSelection,
}: SelectionActionBarProps) {
	if (selectedCount === 0) return null

	return (
		<div
			className={cn(
				"fixed bottom-6 left-1/2 z-50 -translate-x-1/2",
				"flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 shadow-2xl",
				"animate-in slide-in-from-bottom-4 fade-in duration-300",
				"dark:border-slate-600 dark:bg-slate-800"
			)}
		>
			<span className="text-sm font-medium text-slate-200">
				{selectedCount} {selectedCount === 1 ? "evento seleccionado" : "eventos seleccionados"}
			</span>

			<div className="h-5 w-px bg-slate-700" />

			<Button
				size="sm"
				onClick={onAssign}
				className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
			>
				<Users className="h-4 w-4" />
				Asignar proveedor
			</Button>

			{onExportSelection && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							size="sm"
							variant="outline"
							disabled={selectedCount === 0}
							className="gap-1.5 border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white"
						>
							<FileDown className="h-4 w-4" />
							Exportar selección
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-44">
						<DropdownMenuItem onClick={() => onExportSelection("pdf")}>
							<FileDown className="h-4 w-4" />
							PDF
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => onExportSelection("xlsx")}>
							<FileSpreadsheet className="h-4 w-4" />
							Excel
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}

			<Button
				size="sm"
				variant="ghost"
				onClick={onClearSelection}
				className="gap-1.5 text-slate-400 hover:text-white"
			>
				<X className="h-4 w-4" />
				Deseleccionar
			</Button>
		</div>
	)
}
