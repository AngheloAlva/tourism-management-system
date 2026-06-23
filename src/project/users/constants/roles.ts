export const USER_ROLE = {
	ADMIN: "admin",
	OPERADORA: "operadora",
	USER: "user",
} as const

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]

export const USER_ROLE_LABEL: Record<UserRole, string> = {
	[USER_ROLE.ADMIN]: "Administrador",
	[USER_ROLE.OPERADORA]: "Operadora",
	[USER_ROLE.USER]: "Solo lectura",
}

export function getRoleLabel(role: string | null | undefined): string {
	if (!role) return "Sin rol"
	if (role in USER_ROLE_LABEL) {
		return USER_ROLE_LABEL[role as UserRole]
	}

	return role
}
