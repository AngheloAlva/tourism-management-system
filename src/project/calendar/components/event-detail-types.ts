import type { UpdatePassengerData } from "@/project/events/actions/event.actions"
import type { ProviderWithCatering } from "@/project/providers/actions/provider.actions"

export interface EventFormData {
	status: string
	startTime: string
	endTime: string
	guideId: string
	driverId: string
	vehicleId: string
	cateringProviderId: string
	cateringCost: number
	cateringSelection: { id: string; name: string; price: number }[]
	comments: string
	operationalNotes: string
	cateringNotes: string
	guideCost: number
	driverCost: number
	vehicleCost: number
	isCompleted: boolean
}

export type { UpdatePassengerData, ProviderWithCatering }
