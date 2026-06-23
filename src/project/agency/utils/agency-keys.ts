export const agencyKeys = {
	useActiveAgencies: () => ["agencies", "active"] as const,
	useAllAgencies: () => ["agencies", "all"] as const,
	useAgency: (id: string) => ["agency", id] as const,
	useCreateAgency: () => ["agencies"] as const,
	useUpdateAgency: () => ["agencies"] as const,
	useDeleteAgency: () => ["agencies"] as const,
	useToggleAgencyStatus: () => ["agencies"] as const,
}
