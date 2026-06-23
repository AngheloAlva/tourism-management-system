import { create } from "zustand"

interface SaleFormState {
	editMode: boolean
	editingRecordId: string | null
	editingVoucher: number | null
	agencyName?: string
	wholesaleAgencyName?: string
	setAgencyName: (name: string) => void
	setWholesaleAgencyName: (name: string) => void
	resetForm: () => void
	setEditMode: (editMode: boolean, recordId?: string, voucher?: number) => void
}

export const useSaleFormStore = create<SaleFormState>()((set) => ({
	editMode: false,
	editingRecordId: null,
	editingVoucher: null,
	setAgencyName: (name) => set({ agencyName: name }),
	setWholesaleAgencyName: (name) => set({ wholesaleAgencyName: name }),
	resetForm: () =>
		set({
			editMode: false,
			editingRecordId: null,
			editingVoucher: null,
			agencyName: undefined,
			wholesaleAgencyName: undefined,
		}),
	setEditMode: (editMode, recordId, voucher) =>
		set({
			editMode,
			editingRecordId: recordId || null,
			editingVoucher: voucher ?? null,
		}),
}))
