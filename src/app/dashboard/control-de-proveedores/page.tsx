"use client"

import { AlertCircle, Plus } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"

import { createProviderColumns } from "@/project/providers/columns/provider.columns"
import {
	useProviders,
	useProvidersSummary,
	useToggleProviderStatus,
	providerKeys,
} from "@/project/providers/hooks/use-providers"

import { ProvidersDataTable } from "@/project/providers/components/providers-data-table"
import { ProvidersInsights } from "@/project/providers/components/providers-insights"
import { ProvidersPageHeader } from "@/project/providers/components/providers-page-header"
import { DeleteProviderDialog } from "@/project/providers/components/delete-provider-dialog"
import { Button } from "@/shared/components/ui/button"
import { ModuleLoadingSkeleton } from "@/shared/components/ui/module-loading-skeleton"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"

import type { Provider } from "@/generated/prisma/client"

export default function ControlDeProveedoresPage() {
	const router = useRouter()
	const queryClient = useQueryClient()
	const { data: providers, isLoading: providersLoading, error: providersError } = useProviders()
	const { data: summary, isLoading: summaryLoading, error: summaryError } = useProvidersSummary()
	const toggleProviderStatus = useToggleProviderStatus()

	const [providerToDelete, setProviderToDelete] = useState<Provider | null>(null)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

	const handleEdit = (provider: Provider) => {
		router.push(`/dashboard/control-de-proveedores/${provider.id}`)
	}

	const handleDelete = (id: string) => {
		const provider = providers?.find((p) => p.id === id) ?? null
		setProviderToDelete(provider)
		setDeleteDialogOpen(true)
	}

	const handleToggleStatus = async (id: string, active: boolean) => {
		await toggleProviderStatus.mutateAsync({ id, active })
	}

	const columns = createProviderColumns({
		onEdit: handleEdit,
		onDelete: handleDelete,
		onToggleStatus: handleToggleStatus,
	})

	if (providersLoading || summaryLoading) {
		return (
			<ModuleLoadingSkeleton
				titleWidthClassName="w-[340px]"
				descriptionWidthClassName="w-[430px]"
			/>
		)
	}

	if (providersError || summaryError) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<div className="text-center">
					<AlertCircle className="text-destructive mx-auto h-8 w-8" />
					<p className="text-destructive mt-4">Error al cargar los datos</p>
					<p className="text-muted-foreground mt-2 text-sm">
						{providersError?.message || summaryError?.message}
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<ProvidersPageHeader
				title="Control de Proveedores"
				description="Administra guías, conductores y vehículos"
				action={
					<Link href="/dashboard/control-de-proveedores/nuevo">
						<Button className="bg-primary hover:bg-orange-600" data-testid="provider-button-create">
							<Plus className="h-4 w-4" />
							Nuevo Proveedor
						</Button>
					</Link>
				}
			/>

			{summary && <ProvidersInsights summary={summary} />}

			<Card>
				<CardHeader>
					<CardTitle>Listado de Proveedores</CardTitle>
					<CardDescription>
						Gestiona todos los proveedores registrados ({providers?.length || 0} registros)
					</CardDescription>
				</CardHeader>

				<CardContent>
					{providers && <ProvidersDataTable columns={columns} data={providers} />}
				</CardContent>
			</Card>

			<DeleteProviderDialog
				provider={providerToDelete}
				open={deleteDialogOpen}
				onOpenChange={(open) => {
					setDeleteDialogOpen(open)
					if (!open) setProviderToDelete(null)
				}}
				onSuccess={() => {
					queryClient.invalidateQueries({ queryKey: providerKeys.lists() })
					queryClient.invalidateQueries({ queryKey: providerKeys.summary() })
				}}
			/>
		</div>
	)
}
