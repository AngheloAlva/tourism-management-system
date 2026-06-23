import { z } from "zod"

export const updateEventSchema = z.object({
	status: z
		.enum(["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "TRANSFERRED"])
		.optional(),
	startTime: z.string().optional(),
	endTime: z.string().optional(),
	guideId: z.string().optional(),
	driverId: z.string().optional(),
	vehicleId: z.string().optional(),
	cateringProviderId: z.string().optional(),
	comments: z.string().optional(),
	operationalNotes: z.string().optional(),
	cateringNotes: z.string().optional(),
    guideCost: z.number().optional(),
    driverCost: z.number().optional(),
    vehicleCost: z.number().optional(),
    cateringCost: z.number().optional(),
	cateringSelection: z.any().optional(),
	isCompleted: z.boolean(),
})

export type UpdateEventSchema = z.infer<typeof updateEventSchema>

// --- Bulk Assignment Schema ---

export const bulkAssignSchema = z.object({
	eventIds: z.array(z.string()).min(1).max(50),
	guideId: z.string().nullable().optional(),
	driverId: z.string().nullable().optional(),
	vehicleId: z.string().nullable().optional(),
	guideCost: z.number().optional(),
	driverCost: z.number().optional(),
	vehicleCost: z.number().optional(),
})

export type BulkAssignSchema = z.infer<typeof bulkAssignSchema>
