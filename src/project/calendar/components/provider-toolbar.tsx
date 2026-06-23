"use client"

import { useMemo, useState } from "react"
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/shared/components/ui/input"
import { Button } from "@/shared/components/ui/button"
import { ScrollArea } from "@/shared/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"

import { DraggableProviderItem } from "./draggable-provider-item"
import { getProviderServiceCost } from "./event-detail-utils"
import type { ProviderWithCatering } from "@/project/providers/actions/provider.actions"

// --- Props ---

interface ProviderToolbarProps {
	isOpen: boolean
	onToggle: () => void
	providers: ProviderWithCatering[] | undefined
}

// --- Component ---

export function ProviderToolbar({ isOpen, onToggle, providers }: ProviderToolbarProps) {
	const [search, setSearch] = useState("")
	const [activeTab, setActiveTab] = useState("guides")

	// --- Filtered provider lists ---

	const guides = useMemo(() => {
		const list = providers?.filter((p) => p.guia && p.isActive) ?? []
		if (!search.trim()) return list
		const q = search.toLowerCase()
		return list.filter(
			(p) => p.fullName?.toLowerCase().includes(q) || p.companyName?.toLowerCase().includes(q)
		)
	}, [providers, search])

	const drivers = useMemo(() => {
		const list = providers?.filter((p) => p.isActive && (p.conductor || p.conductorMaquina)) ?? []
		if (!search.trim()) return list
		const q = search.toLowerCase()
		return list.filter(
			(p) => p.fullName?.toLowerCase().includes(q) || p.companyName?.toLowerCase().includes(q)
		)
	}, [providers, search])

	const vehicles = useMemo(() => {
		const list = providers?.filter((p) => p.isActive && (p.maquina || p.conductorMaquina)) ?? []
		if (!search.trim()) return list
		const q = search.toLowerCase()
		return list.filter(
			(p) =>
				p.fullName?.toLowerCase().includes(q) ||
				p.companyName?.toLowerCase().includes(q) ||
				p.vehicleBrand?.toLowerCase().includes(q) ||
				p.vehicleModel?.toLowerCase().includes(q) ||
				p.vehiclePlate?.toLowerCase().includes(q)
		)
	}, [providers, search])

	// --- Collapsed state ---

	if (!isOpen) {
		return (
			<div className="flex shrink-0 flex-col items-center py-2">
				<Button
					variant="ghost"
					size="icon"
					onClick={onToggle}
					className="h-8 w-8"
					title="Abrir panel de proveedores"
				>
					<PanelLeftOpen className="h-4 w-4" />
				</Button>
			</div>
		)
	}

	// --- Expanded state ---

	return (
		<div className="bg-background flex w-[260px] shrink-0 flex-col">
			{/* Header */}
			<div className="flex items-center justify-between border-b px-3 py-2">
				<span className="text-xs font-semibold tracking-wide uppercase">Proveedores</span>
				<Button
					variant="ghost"
					size="icon"
					onClick={onToggle}
					className="h-7 w-7"
					title="Cerrar panel"
				>
					<PanelLeftClose className="h-4 w-4" />
				</Button>
			</div>

			{/* Search */}
			<div className="border-b px-3 py-2">
				<div className="relative">
					<Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
					<Input
						placeholder="Buscar..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-7 pl-7 text-xs"
					/>
				</div>
			</div>

			{/* Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
				<TabsList className="mx-3 mt-2 grid w-auto grid-cols-3">
					<TabsTrigger value="guides" className="text-[10px]">
						Guías ({guides.length})
					</TabsTrigger>
					<TabsTrigger value="drivers" className="text-[10px]">
						Choferes ({drivers.length})
					</TabsTrigger>
					<TabsTrigger value="vehicles" className="text-[10px]">
						Vehículos ({vehicles.length})
					</TabsTrigger>
				</TabsList>

				<TabsContent value="guides" className="mt-0 min-h-0 flex-1">
					<ScrollArea className="h-full max-h-[60vh]">
						<div className="space-y-1 p-2">
							{guides.length === 0 && (
								<p className="text-muted-foreground py-4 text-center text-xs">Sin resultados</p>
							)}
							{guides.map((g) => (
								<DraggableProviderItem
									key={g.id}
									id={g.id}
									name={g.fullName || g.companyName || "Sin nombre"}
									role="guide"
									cost={getProviderServiceCost(g, "guide")}
								/>
							))}
						</div>
					</ScrollArea>
				</TabsContent>

				<TabsContent value="drivers" className="mt-0 min-h-0 flex-1">
					<ScrollArea className="h-full max-h-[60vh]">
						<div className="space-y-1 p-2">
							{drivers.length === 0 && (
								<p className="text-muted-foreground py-4 text-center text-xs">Sin resultados</p>
							)}
							{drivers.map((d) => (
								<DraggableProviderItem
									key={d.id}
									id={d.id}
									name={d.fullName || d.companyName || "Sin nombre"}
									role="driver"
									cost={getProviderServiceCost(d, "driver")}
									subtitle={d.licenseType ? `Lic: ${d.licenseType}` : undefined}
								/>
							))}
						</div>
					</ScrollArea>
				</TabsContent>

				<TabsContent value="vehicles" className="mt-0 min-h-0 flex-1">
					<ScrollArea className="h-full max-h-[60vh]">
						<div className="space-y-1 p-2">
							{vehicles.length === 0 && (
								<p className="text-muted-foreground py-4 text-center text-xs">Sin resultados</p>
							)}
							{vehicles.map((v) => {
								const label = [v.vehicleBrand, v.vehicleModel].filter(Boolean).join(" ")
								const displayName = label || v.fullName || v.companyName || "Sin nombre"
								const subtitle = [
									v.vehiclePlate,
									v.vehicleCapacity ? `${v.vehicleCapacity} pax` : null,
								]
									.filter(Boolean)
									.join(" · ")

								return (
									<DraggableProviderItem
										key={v.id}
										id={v.id}
										name={displayName}
										role="vehicle"
										cost={getProviderServiceCost(v, "vehicle")}
										subtitle={subtitle || undefined}
									/>
								)
							})}
						</div>
					</ScrollArea>
				</TabsContent>
			</Tabs>
		</div>
	)
}
