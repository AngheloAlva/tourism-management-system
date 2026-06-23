"use client"

import { FilterXIcon, Plus, Save, Search, Shield } from "lucide-react"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { createRole, updateRoleMeta, updateRolePermissions } from "../actions/role.actions"
import type { ModuleDefinition } from "../constants/modules"
import { useRoleModuleDefinitions, useRolesWithPermissions } from "../hooks/use-roles"

import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { cn } from "@/lib/utils"
import { TableFilterDropdown } from "@/shared/components/ui/table-filter-dropdown"
import { ModuleLoadingSkeleton } from "@/shared/components/ui/module-loading-skeleton"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"
import {
	Dialog,
	DialogTitle,
	DialogHeader,
	DialogFooter,
	DialogContent,
	DialogDescription,
} from "@/shared/components/ui/dialog"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Switch } from "@/shared/components/ui/switch"
import { ScrollArea } from "@/shared/components/ui/scroll-area"
import { RolesInsights } from "./roles-insights"
import { RoleMetaFields } from "./role-meta-fields"

type PermissionDraft = {
	moduleKey: string
	visible: boolean
	canInteract: boolean
}

type RolePermission = {
	moduleKey: string
	visible: boolean
	canInteract: boolean
}

type RoleRow = {
	id: string
	key: string
	name: string
	description: string | null
	isActive: boolean
	isSystem: boolean
	permissions: RolePermission[]
}

const ROLE_FILTER = {
	ALL: "all",
	ACTIVE: "active",
	INACTIVE: "inactive",
	SYSTEM: "system",
	CUSTOM: "custom",
	INTERACTIVE: "interactive",
	READ_ONLY: "read-only",
} as const

export function RolesManagementPage() {
	const queryClient = useQueryClient()
	const { data: roles = [], isLoading } = useRolesWithPermissions()
	const { data: modules = [] } = useRoleModuleDefinitions()
	const roleRows = roles as RoleRow[]
	const moduleRows = modules as ModuleDefinition[]

	const [createDialogOpen, setCreateDialogOpen] = useState(false)
	const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
	const [isSaving, setIsSaving] = useState(false)

	const [newRoleName, setNewRoleName] = useState("")
	const [newRoleKey, setNewRoleKey] = useState("")
	const [newRoleDescription, setNewRoleDescription] = useState("")
	const [searchInput, setSearchInput] = useState("")
	const [statusFilter, setStatusFilter] = useState<string>(ROLE_FILTER.ALL)
	const [typeFilter, setTypeFilter] = useState<string>(ROLE_FILTER.ALL)
	const [capabilityFilter, setCapabilityFilter] = useState<string>(ROLE_FILTER.ALL)

	const editingRole = roleRows.find((role) => role.id === editingRoleId)

	const [roleName, setRoleName] = useState("")
	const [roleDescription, setRoleDescription] = useState("")
	const [roleActive, setRoleActive] = useState(true)
	const [permissionDraft, setPermissionDraft] = useState<Record<string, PermissionDraft>>({})

	const filteredRoles = roleRows.filter((role) => {
		if (statusFilter === ROLE_FILTER.ACTIVE && !role.isActive) {
			return false
		}

		if (statusFilter === ROLE_FILTER.INACTIVE && role.isActive) {
			return false
		}

		if (typeFilter === ROLE_FILTER.SYSTEM && !role.isSystem) {
			return false
		}

		if (typeFilter === ROLE_FILTER.CUSTOM && role.isSystem) {
			return false
		}

		const hasInteractivePermissions = role.permissions.some((permission) => permission.canInteract)
		if (capabilityFilter === ROLE_FILTER.INTERACTIVE && !hasInteractivePermissions) {
			return false
		}

		if (capabilityFilter === ROLE_FILTER.READ_ONLY && hasInteractivePermissions) {
			return false
		}

		if (searchInput.trim()) {
			const normalizedSearch = searchInput.toLowerCase().trim()
			const description = role.description || ""
			return (
				role.name.toLowerCase().includes(normalizedSearch) ||
				role.key.toLowerCase().includes(normalizedSearch) ||
				description.toLowerCase().includes(normalizedSearch)
			)
		}

		return true
	})

	const filterGroups = [
		{
			key: "status",
			label: "Estado",
			value: statusFilter,
			allLabel: "Todos los estados",
			options: [
				{ value: ROLE_FILTER.ACTIVE, label: "Activos" },
				{ value: ROLE_FILTER.INACTIVE, label: "Inactivos" },
			],
			onChange: (nextValue: string) => setStatusFilter(nextValue),
		},
		{
			key: "type",
			label: "Tipo",
			value: typeFilter,
			allLabel: "Todos los tipos",
			options: [
				{ value: ROLE_FILTER.SYSTEM, label: "Sistema" },
				{ value: ROLE_FILTER.CUSTOM, label: "Personalizados" },
			],
			onChange: (nextValue: string) => setTypeFilter(nextValue),
		},
		{
			key: "capability",
			label: "Acceso",
			value: capabilityFilter,
			allLabel: "Todos los accesos",
			options: [
				{ value: ROLE_FILTER.INTERACTIVE, label: "Con interaccion" },
				{ value: ROLE_FILTER.READ_ONLY, label: "Solo lectura" },
			],
			onChange: (nextValue: string) => setCapabilityFilter(nextValue),
		},
	]

	const clearFilters = () => {
		setSearchInput("")
		setStatusFilter(ROLE_FILTER.ALL)
		setTypeFilter(ROLE_FILTER.ALL)
		setCapabilityFilter(ROLE_FILTER.ALL)
	}

	const hasActiveFilters =
		searchInput.trim().length > 0 ||
		statusFilter !== ROLE_FILTER.ALL ||
		typeFilter !== ROLE_FILTER.ALL ||
		capabilityFilter !== ROLE_FILTER.ALL

	const openRoleEditor = (roleId: string) => {
		const role = roleRows.find((item) => item.id === roleId)
		if (!role) return

		setEditingRoleId(role.id)
		setRoleName(role.name)
		setRoleDescription(role.description || "")
		setRoleActive(role.isActive)

		const draft = Object.fromEntries(
			role.permissions.map((permission) => [
				permission.moduleKey,
				{
					moduleKey: permission.moduleKey,
					visible: permission.visible,
					canInteract: permission.canInteract,
				},
			])
		)
		setPermissionDraft(draft)
	}

	const handleCreateRole = async () => {
		setIsSaving(true)
		try {
			await createRole({
				name: newRoleName,
				key: newRoleKey,
				description: newRoleDescription,
			})
			await queryClient.invalidateQueries({ queryKey: ["roles"] })
			toast.success("Rol creado")
			setCreateDialogOpen(false)
			setNewRoleName("")
			setNewRoleKey("")
			setNewRoleDescription("")
		} catch (error) {
			toast.error("No se pudo crear el rol", {
				description: error instanceof Error ? error.message : "Error desconocido",
			})
		} finally {
			setIsSaving(false)
		}
	}

	const handleSaveRole = async () => {
		if (!editingRole) return

		setIsSaving(true)
		try {
			await updateRoleMeta({
				roleId: editingRole.id,
				name: roleName,
				description: roleDescription,
				isActive: roleActive,
			})

			await updateRolePermissions(editingRole.id, Object.values(permissionDraft))

			await queryClient.invalidateQueries({ queryKey: ["roles"] })
			toast.success("Rol actualizado")
			setEditingRoleId(null)
		} catch (error) {
			toast.error("No se pudo guardar", {
				description: error instanceof Error ? error.message : "Error desconocido",
			})
		} finally {
			setIsSaving(false)
		}
	}

	if (isLoading) {
		return (
			<ModuleLoadingSkeleton
				titleWidthClassName="w-[250px]"
				descriptionWidthClassName="w-[360px]"
			/>
		)
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Roles y Permisos</h1>
					<p className="text-muted-foreground mt-1">
						Define qué módulos ve cada rol y si puede interactuar.
					</p>
				</div>

				<Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
					<Plus className="h-4 w-4" />
					Crear Rol
				</Button>
			</div>

			<RolesInsights roles={roleRows} />

			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="relative w-full lg:max-w-sm">
					<Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
					<Input
						placeholder="Buscar por nombre, clave o descripcion..."
						value={searchInput}
						onChange={(event) => setSearchInput(event.target.value)}
						className="w-full pl-8"
					/>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<TableFilterDropdown groups={filterGroups} onClearAll={clearFilters} />
					<Button
						variant="outline"
						onClick={clearFilters}
						className={cn("gap-2", !hasActiveFilters && "hidden")}
					>
						<FilterXIcon className="h-4 w-4" />
						Limpiar filtros
					</Button>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{filteredRoles.map((role) => (
					<Card key={role.id}>
						<CardHeader>
							<div className="flex items-start justify-between">
								<div>
									<CardTitle className="flex items-center gap-2 text-lg">
										<Shield className="h-4 w-4" />
										{role.name}
									</CardTitle>
									<CardDescription>{role.description || "Sin descripción"}</CardDescription>
								</div>

								<div className="flex items-center gap-2">
									{role.isSystem ? <Badge variant="secondary">Sistema</Badge> : null}
									<Badge variant={role.isActive ? "outline" : "destructive"}>
										{role.isActive ? "Activo" : "Inactivo"}
									</Badge>
								</div>
							</div>
						</CardHeader>

						<CardContent className="space-y-3">
							<p className="text-muted-foreground text-sm">Clave: {role.key}</p>
							<p className="text-sm">
								Visibles: {role.permissions.filter((permission) => permission.visible).length} /{" "}
								{moduleRows.length}
							</p>
							<p className="text-sm">
								Interacción:{" "}
								{role.permissions.filter((permission) => permission.canInteract).length}
							</p>

							<Button variant="outline" className="w-full" onClick={() => openRoleEditor(role.id)}>
								Editar permisos
							</Button>
						</CardContent>
					</Card>
				))}
			</div>

			{filteredRoles.length === 0 ? (
				<Card>
					<CardContent className="text-muted-foreground py-10 text-center">
						No se encontraron roles para los filtros aplicados.
					</CardContent>
				</Card>
			) : null}

			<Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Crear rol</DialogTitle>
						<DialogDescription>
							Los nuevos roles parten sin acceso, luego puedes configurarlos.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3">
						<RoleMetaFields
							name={newRoleName}
							description={newRoleDescription}
							onNameChange={setNewRoleName}
							onDescriptionChange={setNewRoleDescription}
						/>
						<div className="space-y-1">
							<Label>Clave</Label>
							<Input
								value={newRoleKey}
								onChange={(event) => setNewRoleKey(event.target.value)}
								placeholder="ej: supervisor-operaciones"
							/>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
							Cancelar
						</Button>
						<Button onClick={handleCreateRole} disabled={isSaving || !newRoleName || !newRoleKey}>
							{isSaving ? <Save className="h-4 w-4 animate-pulse" /> : <Plus className="h-4 w-4" />}
							Crear
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={Boolean(editingRoleId)}
				onOpenChange={(open) => (!open ? setEditingRoleId(null) : null)}
			>
				<DialogContent className="max-h-[90vh] sm:max-w-3xl">
					<DialogHeader>
						<DialogTitle>Editar Rol</DialogTitle>
						<DialogDescription>
							Visible habilita el módulo en navegación. Interactuar permite crear, editar y
							solicitar eliminaciones.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 md:grid-cols-2">
						<RoleMetaFields
							name={roleName}
							description={roleDescription}
							onNameChange={setRoleName}
							onDescriptionChange={setRoleDescription}
						/>
					</div>

					<div className="flex items-center justify-between rounded-md border p-3">
						<div>
							<p className="font-medium">Rol activo</p>
							<p className="text-muted-foreground text-sm">
								Si está inactivo no debe asignarse a nuevos usuarios.
							</p>
						</div>
						<Switch checked={roleActive} onCheckedChange={setRoleActive} />
					</div>

					<ScrollArea className="h-[360px] rounded-md border">
						<div className="space-y-2 p-3">
							{moduleRows.map((module) => {
								const current = permissionDraft[module.key] || {
									moduleKey: module.key,
									visible: false,
									canInteract: false,
								}

								return (
									<div
										key={module.key}
										className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border p-3"
									>
										<div>
											<p className="font-medium">{module.label}</p>
											<p className="text-muted-foreground text-xs">{module.path}</p>
										</div>
										<div className="flex items-center gap-2">
											<Label>Visible</Label>
											<Switch
												checked={current.visible}
												onCheckedChange={(checked) =>
													setPermissionDraft((prev) => ({
														...prev,
														[module.key]: {
															...current,
															visible: checked,
															canInteract: checked ? current.canInteract : false,
														},
													}))
												}
											/>
										</div>
										<div className="flex items-center gap-2">
											<Label>Interactuar</Label>
											<Switch
												checked={current.canInteract}
												disabled={!current.visible}
												onCheckedChange={(checked) =>
													setPermissionDraft((prev) => ({
														...prev,
														[module.key]: {
															...current,
															visible: checked ? true : current.visible,
															canInteract: checked,
														},
													}))
												}
											/>
										</div>
									</div>
								)
							})}
						</div>
					</ScrollArea>

					<DialogFooter>
						<Button variant="outline" onClick={() => setEditingRoleId(null)}>
							Cancelar
						</Button>
						<Button
							onClick={handleSaveRole}
							disabled={isSaving || !editingRoleId}
							className="gap-2"
						>
							<Save className="h-4 w-4" />
							Guardar cambios
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
