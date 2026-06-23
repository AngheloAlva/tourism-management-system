import type { ProviderWithCatering } from "@/project/providers/actions/provider.actions"
import type { CalendarViewEvent, MissingRole } from "../types/calendar.types"

export { isPassengerComplete } from "@/shared/utils/passenger-utils"

export const getSortableCost = (cost?: number | null) =>
	cost && cost > 0 ? cost : Number.POSITIVE_INFINITY

export const getProviderServiceCost = (
	provider: ProviderWithCatering | undefined,
	type: "guide" | "driver" | "vehicle"
) => {
	if (!provider) return 0
	if (type === "guide") return provider.guideCost || provider.costPerDay || 0
	if (type === "driver") return provider.driverCost || provider.costPerDay || 0
	return provider.vehicleCost || provider.costPerDay || 0
}

export const getMinCateringCost = (provider: ProviderWithCatering) => {
	const prices = provider.catering?.map((c) => c.pricePerPerson).filter((p) => p > 0) || []
	return prices.length ? Math.min(...prices) : Number.POSITIVE_INFINITY
}

// --- Assignment Completeness ---

export function isAssignmentComplete(event: CalendarViewEvent): boolean {
	const hasDriver = !!event.driverId
	const hasVehicle = !!event.vehicleId
	const hasGuide = !!event.guideId || event.serviceKind === "TRANSFER"
	return hasDriver && hasVehicle && hasGuide
}

export function getMissingAssignments(event: CalendarViewEvent): MissingRole[] {
	const missing: MissingRole[] = []
	if (!event.guideId && event.serviceKind !== "TRANSFER") missing.push("guide")
	if (!event.driverId) missing.push("driver")
	if (!event.vehicleId) missing.push("vehicle")
	return missing
}
