export const SALE_CHANNEL_LABEL: Record<string, string> = {
	ONLINE: "Online",
	AGENCY: "Agencia",
	PHYSICAL: "Físico",
	WHOLESALE: "Mayorista",
}

export function getSaleChannelLabel(channel: string): string {
	return SALE_CHANNEL_LABEL[channel] ?? channel
}
