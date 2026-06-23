"use client"

import { AlertCircle, Building2, CircleCheck, CircleX } from "lucide-react"
import { useEffect, useState } from "react"

import { AgencyDataTable } from "@/project/agency/components/agency-data-table"
import { agencyColumns } from "@/project/agency/columns/agency-columns"
import {
	useAllAgencies,
	useToggleAgencyStatus,
} from "@/project/agency/hooks/use-agencies"

import { CreateAgencyDialog } from "@/project/agency/components/create-agency-dialog"
import { DeleteAgencyDialog } from "@/project/agency/components/delete-agency-dialog"
import { DashboardStatCard } from "@/shared/components/ui/dashboard-stat-card"
import { ModuleLoadingSkeleton } from "@/shared/components/ui/module-loading-skeleton"
import {
	AlertDialog,
	AlertDialogTitle,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
} from "@/shared/components/ui/alert-dialog"

import type { Agency } from "@/project/agency/types/agency"

export default function AgenciesPage() {
	const { data: agencies, isLoading, error } = useAllAgencies()
	const toggleStatus = useToggleAgencyStatus()

	const [agencyToEdit, setAgencyToEdit] = useState<Agency | null>(null)
	const [agencyToDelete, setAgencyToDelete] = useState<Agency | null>(null)
	const [agencyToToggle, setAgencyToToggle] = useState<string | null>(null)
	const [showEditDialog, setShowEditDialog] = useState(false)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

	useEffect(() => {
		const handleEditAgency = (event: Event) => {
			const customEvent = event as CustomEvent<Agency>
			setAgencyToEdit(customEvent.detail)
			setShowEditDialog(true)
		}

		const handleDeleteAgency = (event: Event) => {
			const customEvent = event as CustomEvent<string>
			const found = agencies?.find((a) => a.id === customEvent.detail) ?? null
			setAgencyToDelete(found)
			setDeleteDialogOpen(true)
		}

		const handleToggleAgency = (event: Event) => {
			const customEvent = event as CustomEvent<string>
			setAgencyToToggle(customEvent.detail)
		}

		window.addEventListener("editAgency", handleEditAgency)
		window.addEventListener("deleteAgency", handleDeleteAgency)
		window.addEventListener("toggleAgency", handleToggleAgency)

		return () => {
			window.removeEventListener("editAgency", handleEditAgency)
			window.removeEventListener("deleteAgency", handleDeleteAgency)
			window.removeEventListener("toggleAgency", handleToggleAgency)
		}
	}, [agencies])

	const handleToggle = async () => {
		if (agencyToToggle) {
			await toggleStatus.mutateAsync(agencyToToggle)
			setAgencyToToggle(null)
		}
	}

	if (isLoading) {
		return (
			<ModuleLoadingSkeleton
				titleWidthClassName="w-[310px]"
				descriptionWidthClassName="w-[430px]"
			/>
		)
	}

	if (error) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<div className="text-center">
					<AlertCircle className="text-destructive mx-auto h-8 w-8" />
					<p className="text-destructive mt-4">Error al cargar las agencias</p>
					<p className="text-muted-foreground mt-2 text-sm">{error.message}</p>
				</div>
			</div>
		)
	}

	const activeAgencies = agencies?.filter((a) => a.active).length || 0
	const inactiveAgencies = agencies?.filter((a) => !a.active).length || 0
	const stats = [
		{
			title: "Total de mayoristas",
			value: agencies?.length || 0,
			description: "Registradas en el sistema",
			icon: Building2,
			iconClassName: "text-blue-500",
			iconWrapperClassName: "bg-blue-500/30",
		},
		{
			title: "Activas",
			value: activeAgencies,
			description: "Operando actualmente",
			icon: CircleCheck,
			iconClassName: "text-emerald-500",
			iconWrapperClassName: "bg-emerald-500/30",
		},
		{
			title: "Inactivas",
			value: inactiveAgencies,
			description: "Temporalmente deshabilitadas",
			icon: CircleX,
			iconClassName: "text-slate-500",
			iconWrapperClassName: "bg-slate-500/30",
		},
	]

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Gestión de Mayoristas</h1>
					<p className="text-muted-foreground mt-1">Gestiona las agencias mayoristas</p>
				</div>
				<CreateAgencyDialog />
			</div>

			{/* Stats Cards */}
			<div className="grid gap-4 md:grid-cols-3">
				{stats.map((stat) => (
					<DashboardStatCard
						key={stat.title}
						title={stat.title}
						value={stat.value}
						description={stat.description}
						icon={stat.icon}
						iconClassName={stat.iconClassName}
						iconWrapperClassName={stat.iconWrapperClassName}
					/>
				))}
			</div>

			{/* Data Table */}
			<section className="space-y-4">
				<div>
					<h2 className="text-lg font-semibold">Lista de Mayoristas</h2>
					<p className="text-muted-foreground text-sm">
						Visualiza y administra todas las agencias mayoristas registradas
					</p>
				</div>
				{agencies && <AgencyDataTable columns={agencyColumns} data={agencies} />}
			</section>

			{/* Edit Dialog */}
			{agencyToEdit && (
				<CreateAgencyDialog
					agency={agencyToEdit}
					open={showEditDialog}
					onOpenChange={(open) => {
						setShowEditDialog(open)
						if (!open) {
							setAgencyToEdit(null)
						}
					}}
					trigger={<button type="button" className="hidden" aria-hidden="true" />}
				/>
			)}

			{/* Delete Agency Dialog — flujo asincrónico de autorizaciones */}
			<DeleteAgencyDialog
				agency={agencyToDelete}
				open={deleteDialogOpen}
				onOpenChange={(open) => {
					setDeleteDialogOpen(open)
					if (!open) setAgencyToDelete(null)
				}}
			/>

			{/* Toggle Status Confirmation Dialog */}
			<AlertDialog open={!!agencyToToggle} onOpenChange={() => setAgencyToToggle(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Cambiar estado de la agencia</AlertDialogTitle>
						<AlertDialogDescription>
							¿Deseas cambiar el estado de esta agencia? Las agencias inactivas no aparecerán en los
							formularios de ventas.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleToggle}>Confirmar</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
