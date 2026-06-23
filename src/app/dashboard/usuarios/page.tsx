"use client"

import { Loader2, AlertCircle } from "lucide-react"
import { useMemo, useState, useCallback } from "react"
import type { PaginationState, SortingState } from "@tanstack/react-table"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import {
	usePaginatedUsers,
	useUsersSummary,
	useCurrentUserRole,
} from "@/project/users/hooks/use-users"
import { authClient } from "@/lib/auth-client"
import { createUserColumns } from "@/project/users/columns/user.columns"
import { setUserRole } from "@/project/users/actions/user.actions"
import { getRoleLabel } from "@/project/users/constants/roles"
import { useAssignableRoles } from "@/project/roles/hooks/use-roles"
import { SYSTEM_ROLE_KEY } from "@/project/roles/constants/system-roles"

import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar"
import { CreateUserDialog } from "@/project/users/components/create-user-dialog"
import { UsersDataTable } from "@/project/users/components/users-data-table"
import { UsersInsights } from "@/project/users/components/users-insights"
import { ResetPasswordDialog } from "@/project/users/components/reset-password-dialog"
import { BanUserDialog } from "@/project/users/components/ban-user-dialog"
import { ModuleLoadingSkeleton } from "@/shared/components/ui/module-loading-skeleton"
import { Separator } from "@/shared/components/ui/separator"
import { Badge } from "@/shared/components/ui/badge"
import {
	Dialog,
	DialogTitle,
	DialogHeader,
	DialogContent,
	DialogFooter,
	DialogDescription,
} from "@/shared/components/ui/dialog"
import {
	Select,
	SelectItem,
	SelectValue,
	SelectContent,
	SelectTrigger,
} from "@/shared/components/ui/select"
import { Button } from "@/shared/components/ui/button"

import type { UserWithStats } from "@/project/users/actions/user.actions"
import type { AssignableRole } from "@/project/roles/hooks/use-roles"

const EMPTY_USERS: UserWithStats[] = []
const EMPTY_ASSIGNABLE_ROLES: AssignableRole[] = []

export default function UsersPage() {
	const { data: session } = authClient.useSession()
	const currentUserId = session?.user?.id ?? ""

	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 15,
	})
	const [sorting, setSorting] = useState<SortingState>([])
	const [userSearch, setUserSearch] = useState("")
	const sortParam = sorting[0]
		? { field: sorting[0].id, order: (sorting[0].desc ? "desc" : "asc") as "asc" | "desc" }
		: undefined
	const {
		data: paginatedUsers,
		isLoading: usersLoading,
		isFetching: usersFetching,
		error: usersError,
	} = usePaginatedUsers(
		pagination.pageIndex + 1,
		pagination.pageSize,
		userSearch || undefined,
		sortParam
	)
	const { data: summary, isLoading: summaryLoading, error: summaryError } = useUsersSummary()
	const { data: currentUserRole } = useCurrentUserRole()
	const isAdmin = currentUserRole === SYSTEM_ROLE_KEY.ADMIN
	const { data: assignableRolesData } = useAssignableRoles(isAdmin)
	const queryClient = useQueryClient()
	const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null)
	const [detailsOpen, setDetailsOpen] = useState(false)
	const [roleDialogOpen, setRoleDialogOpen] = useState(false)
	const [editingRoleUser, setEditingRoleUser] = useState<UserWithStats | null>(null)
	const [selectedRole, setSelectedRole] = useState<string>("")
	const [isUpdatingRole, setIsUpdatingRole] = useState(false)
	const [resetPasswordUser, setResetPasswordUser] = useState<UserWithStats | null>(null)
	const [resetPasswordOpen, setResetPasswordOpen] = useState(false)
	const [banDialogUser, setBanDialogUser] = useState<UserWithStats | null>(null)
	const [banDialogOpen, setBanDialogOpen] = useState(false)
	const usersData = paginatedUsers?.data ?? EMPTY_USERS
	const totalRecords = paginatedUsers?.total ?? 0
	const assignableRoles = assignableRolesData ?? EMPTY_ASSIGNABLE_ROLES

	const handleViewDetails = useCallback((user: UserWithStats) => {
		setSelectedUser(user)
		setDetailsOpen(true)
	}, [])

	const handleEdit = useCallback(
		(user: UserWithStats) => {
			if (!isAdmin) {
				toast.error("Solo un administrador puede cambiar roles")
				return
			}

			setEditingRoleUser(user)
			setSelectedRole(user.role || assignableRoles[0]?.key || SYSTEM_ROLE_KEY.USER)
			setRoleDialogOpen(true)
		},
		[assignableRoles, isAdmin]
	)

	const handleUpdateRole = async () => {
		if (!editingRoleUser) return
		if (!selectedRole) {
			toast.error("Debe seleccionar un rol")
			return
		}

		setIsUpdatingRole(true)
		try {
			await setUserRole({
				userId: editingRoleUser.id,
				role: selectedRole,
			})
			await queryClient.invalidateQueries({ queryKey: ["users"] })
			toast.success("Rol actualizado correctamente")
			setRoleDialogOpen(false)
			setEditingRoleUser(null)
			setSelectedRole("")
		} catch (error) {
			toast.error("No se pudo actualizar el rol", {
				description: error instanceof Error ? error.message : "Error desconocido",
			})
		} finally {
			setIsUpdatingRole(false)
		}
	}

	const handleToggleBan = useCallback((user: UserWithStats) => {
		setBanDialogUser(user)
		setBanDialogOpen(true)
	}, [])

	const handleResetPassword = useCallback((user: UserWithStats) => {
		setResetPasswordUser(user)
		setResetPasswordOpen(true)
	}, [])

	const columns = useMemo(
		() => createUserColumns(handleViewDetails, handleEdit, handleToggleBan, handleResetPassword),
		[handleEdit, handleToggleBan, handleViewDetails, handleResetPassword]
	)

	if (usersLoading || summaryLoading) {
		return (
			<ModuleLoadingSkeleton
				titleWidthClassName="w-[300px]"
				descriptionWidthClassName="w-[420px]"
			/>
		)
	}

	if (usersError || summaryError) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<div className="text-center">
					<AlertCircle className="text-destructive mx-auto h-8 w-8" />
					<p className="text-destructive mt-4">Error al cargar los datos</p>
					<p className="text-muted-foreground mt-2 text-sm">
						{usersError?.message || summaryError?.message}
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h1>
					<p className="text-muted-foreground mt-1">
						Administra los usuarios del sistema y sus permisos
					</p>
				</div>

				{isAdmin ? <CreateUserDialog /> : null}
			</div>

			{summary && <UsersInsights summary={summary} />}

			<section className="space-y-4">
				<div>
					<h2 className="text-lg font-semibold">Lista de Usuarios</h2>
					<p className="text-muted-foreground text-sm">
						Todos los usuarios registrados en el sistema ({totalRecords} usuarios)
					</p>
				</div>
				<UsersDataTable
					columns={columns}
					data={usersData}
					totalRecords={totalRecords}
					pagination={pagination}
					onPaginationChange={setPagination}
					sorting={sorting}
					onSortingChange={(next) => {
						setSorting(next)
						setPagination((prev) => ({ ...prev, pageIndex: 0 }))
					}}
					isLoading={usersFetching}
					onSearchChange={(search) => {
						setUserSearch(search)
						setPagination((prev) => ({ ...prev, pageIndex: 0 }))
					}}
				/>
			</section>

			<Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
				<DialogContent className="sm:max-w-[600px]">
					<DialogHeader>
						<DialogTitle>Detalles del Usuario</DialogTitle>
						<DialogDescription>Información completa del usuario seleccionado</DialogDescription>
					</DialogHeader>

					{selectedUser && (
						<div className="space-y-6">
							<div className="flex items-start gap-4">
								<Avatar className="h-16 w-16">
									<AvatarImage src={selectedUser.image || undefined} alt={selectedUser.name} />
									<AvatarFallback className="text-lg">
										{selectedUser.name
											.split(" ")
											.map((n) => n[0])
											.join("")
											.toUpperCase()
											.slice(0, 2)}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1 space-y-1">
									<h3 className="text-xl font-semibold">{selectedUser.name}</h3>
									<p className="text-muted-foreground text-sm">{selectedUser.email}</p>
									<div className="flex gap-2">
										<Badge variant={selectedUser.banned ? "destructive" : "outline"}>
											{selectedUser.banned ? "Baneado" : "Activo"}
										</Badge>
										{selectedUser.emailVerified && (
											<Badge variant="default">Email Verificado</Badge>
										)}
										{selectedUser.role && (
											<Badge variant="secondary">{getRoleLabel(selectedUser.role)}</Badge>
										)}
									</div>
								</div>
							</div>

							<Separator />

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1">
									<p className="text-muted-foreground text-sm">Total de Ventas</p>
									<p className="text-2xl font-bold">{selectedUser._count.sales}</p>
								</div>
								<div className="space-y-1">
									<p className="text-muted-foreground text-sm">Teléfono</p>
									<p className="font-medium">{selectedUser.phone || "No registrado"}</p>
								</div>
								<div className="space-y-1">
									<p className="text-muted-foreground text-sm">RUT</p>
									<p className="font-medium">{selectedUser.rut || "No registrado"}</p>
								</div>
								<div className="space-y-1">
									<p className="text-muted-foreground text-sm">Horario de Trabajo</p>
									<p className="font-medium">{selectedUser.workSchedule || "No registrado"}</p>
								</div>
							</div>

							<Separator />

							<div className="space-y-3">
								<div>
									<p className="text-muted-foreground text-sm">Fecha de Nacimiento</p>
									<p className="font-medium">
										{selectedUser.birthDate
											? new Date(selectedUser.birthDate).toLocaleDateString("es-CL", {
													year: "numeric",
													month: "long",
													day: "numeric",
												})
											: "No registrada"}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Fecha de Registro</p>
									<p className="font-medium">
										{new Date(selectedUser.createdAt).toLocaleDateString("es-CL", {
											year: "numeric",
											month: "long",
											day: "numeric",
										})}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Última Actualización</p>
									<p className="font-medium">
										{new Date(selectedUser.updatedAt).toLocaleDateString("es-CL", {
											year: "numeric",
											month: "long",
											day: "numeric",
										})}
									</p>
								</div>
								{selectedUser.banned && selectedUser.banReason && (
									<div>
										<p className="text-muted-foreground text-sm">Razón del Baneo</p>
										<p className="text-destructive font-medium">{selectedUser.banReason}</p>
									</div>
								)}
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>

			{resetPasswordUser && (
				<ResetPasswordDialog
					user={resetPasswordUser}
					currentUserId={currentUserId}
					open={resetPasswordOpen}
					onOpenChange={(open) => {
						setResetPasswordOpen(open)
						if (!open) setResetPasswordUser(null)
					}}
				/>
			)}

			<BanUserDialog
				user={banDialogUser}
				open={banDialogOpen}
				onOpenChange={(open) => {
					setBanDialogOpen(open)
					if (!open) setBanDialogUser(null)
				}}
				onSuccess={async () => {
					await queryClient.invalidateQueries({ queryKey: ["users"] })
				}}
			/>

			<Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
				<DialogContent className="sm:max-w-[420px]">
					<DialogHeader>
						<DialogTitle>Modificar Rol</DialogTitle>
						<DialogDescription>
							{editingRoleUser
								? `Actualiza el rol de ${editingRoleUser.name}`
								: "Selecciona el nuevo rol"}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-2">
						<p className="text-muted-foreground text-sm">Rol</p>
						<Select value={selectedRole} onValueChange={setSelectedRole}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Seleccionar rol" />
							</SelectTrigger>
							<SelectContent>
								{assignableRoles.map((role) => (
									<SelectItem key={role.key} value={role.key}>
										{role.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
							Cancelar
						</Button>
						<Button onClick={handleUpdateRole} disabled={isUpdatingRole || !selectedRole}>
							{isUpdatingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
							Guardar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
