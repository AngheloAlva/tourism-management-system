import { z } from "zod"

// ============================================================
// Zod schema — T-B1
// ============================================================

const HHMM_REGEX = /^\d{2}:\d{2}$/

const rescheduleEventSchema = z.object({
	eventId: z.cuid(),
	newDate: z.date(),
	newStartTime: z.string().regex(HHMM_REGEX).nullable().optional(),
	newEndTime: z.string().regex(HHMM_REGEX).nullable().optional(),
	reason: z
		.string()
		.min(1, { error: "El motivo es obligatorio" })
		.transform((v) => v.trim())
		.refine((v) => v.length > 0, { error: "El motivo no puede estar vacío" }),
	overrideProviderConflict: z.boolean().optional().default(false),
})

type RescheduleEventInput = z.infer<typeof rescheduleEventSchema>

// ============================================================
// Result types — T-B2
// ============================================================

interface PassengerConflict {
	voucher: number | null
	saleRecordId: string
	conflictingEventId: string
	tourName: string | null
	date: Date
	startTime: string | null
	endTime: string | null
}

interface ProviderConflictSummary {
	role: "Guía" | "Conductor" | "Vehículo" | "Catering"
	providerName: string
	conflictingEventId: string
	conflictingTourName: string | null
}

type RescheduleEventResult =
	| { success: true; data: { eventId: string; affectedSaleRecordIds: string[] } }
	| {
			success: false
			error: string
			passengerConflicts?: PassengerConflict[]
			providerConflicts?: ProviderConflictSummary[]
	  }

export { rescheduleEventSchema }
export type {
	RescheduleEventInput,
	PassengerConflict,
	ProviderConflictSummary,
	RescheduleEventResult,
}
