import { create } from "zustand"

interface ReceptionFormState {
	agencyName?: string
	setAgencyName: (name: string) => void
	resetForm: () => void
}

export const useReceptionFormStore = create<ReceptionFormState>((set) => ({
	agencyName: undefined,
	setAgencyName: (name) => set({ agencyName: name }),
	resetForm: () =>
		set({
			agencyName: undefined,
		}),
}))
