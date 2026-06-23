"use client"

import { AlertCircle, Building2, CircleCheck, CircleX } from "lucide-react"
import { useEffect, useState } from "react"

import { TransferAgencyDataTable } from "@/project/transfer-agencies/components/transfer-agency-data-table"
import { transferAgencyColumns } from "@/project/transfer-agencies/columns/transfer-agency-columns"
import {
	useAllTransferAgencies,
	useDeleteTransferAgency,
	useToggleTransferAgencyStatus,
} from "@/project/transfer-agencies/hooks/use-transfer-agencies"

import { CreateTransferAgencyDialog } from "@/project/transfer-agencies/components/create-transfer-agency-dialog"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"
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

import type { TransferAgency } from "@/project/transfer-agencies/types/transfer-agency"

export default function TransferAgenciesPage() {
	const { data: agencies, isLoading, error } = useAllTransferAgencies()
	const deleteAgency = useDeleteTransferAgency()
	const toggleStatus = useToggleTransferAgencyStatus()

	const [agencyToEdit, setAgencyToEdit] = useState<TransferAgency | null>(null)
	const [agencyToDelete, setAgencyToDelete] = useState<string | null>(null)
	const [agencyToToggle, setAgencyToToggle] = useState<string | null>(null)
	const [showEditDialog, setShowEditDialog] = useState(false)

	useEffect(() => {
		const handleEditAgency = (event: Event) => {
			const customEvent = event as CustomEvent<TransferAgency>
			setAgencyToEdit(customEvent.detail)
			setShowEditDialog(true)
		}

		const handleDeleteAgency = (event: Event) => {
			const customEvent = event as CustomEvent<string>
			setAgencyToDelete(customEvent.detail)
		}

		const handleToggleAgency = (event: Event) => {
			const customEvent = event as CustomEvent<string>
			setAgencyToToggle(customEvent.detail)
		}

		window.addEventListener("editTransferAgency", handleEditAgency)
		window.addEventListener("deleteTransferAgency", handleDeleteAgency)
		window.addEventListener("toggleTransferAgency", handleToggleAgency)

		return () => {
			window.removeEventListener("editTransferAgency", handleEditAgency)
			window.removeEventListener("deleteTransferAgency", handleDeleteAgency)
			window.removeEventListener("toggleTransferAgency", handleToggleAgency)
		}
	}, [])

	const handleDelete = async () => {
		if (agencyToDelete) {
			await deleteAgency.mutateAsync(agencyToDelete)
			setAgencyToDelete(null)
		}
	}

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
			title: "Total de agencias",
			value: agencies?.length || 0,
			description: "Receptivas y de traspasos",
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
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Gestión de Agencias</h1>
					<p className="text-muted-foreground mt-1">
						Gestiona agencias para traspasos y recepciones
					</p>
				</div>
				<CreateTransferAgencyDialog />
			</div>

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

			<Card>
				<CardHeader>
					<CardTitle>Lista de Agencias</CardTitle>
					<CardDescription>
						Visualiza y administra agencias de transferencias y recepciones
					</CardDescription>
				</CardHeader>
				<CardContent>
					{agencies && <TransferAgencyDataTable columns={transferAgencyColumns} data={agencies} />}
				</CardContent>
			</Card>

			{agencyToEdit && (
				<CreateTransferAgencyDialog
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

			<AlertDialog open={!!agencyToDelete} onOpenChange={() => setAgencyToDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
						<AlertDialogDescription>
							Esta acción marcará la agencia como inactiva. Podrás reactivarla más tarde.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Eliminar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={!!agencyToToggle} onOpenChange={() => setAgencyToToggle(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Cambiar estado de la agencia</AlertDialogTitle>
						<AlertDialogDescription>
							¿Deseas cambiar el estado de esta agencia? Las agencias inactivas no aparecerán en
							formularios de traspaso y recepción.
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
