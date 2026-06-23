export const transferAgencyKeys = {
	all: ["transfer-agencies"] as const,
	useActiveTransferAgencies: () => [...transferAgencyKeys.all, "active"] as const,
	useAllTransferAgencies: () => [...transferAgencyKeys.all, "all"] as const,
	useTransferAgency: (id: string) => [...transferAgencyKeys.all, id] as const,
}
