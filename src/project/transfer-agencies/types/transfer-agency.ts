export interface TransferAgency {
	id: string
	name: string
	active: boolean
	createdAt: Date
	updatedAt: Date
	phone: string | null
	taxId: string | null
	country: string | null
	address: string | null
	website: string | null
	contactEmails: string[]
}
