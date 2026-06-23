// --- Provider Role ---

const PROVIDER_ROLE = {
	GUIDE: "guide",
	DRIVER: "driver",
	VEHICLE: "vehicle",
} as const

type ProviderRole = (typeof PROVIDER_ROLE)[keyof typeof PROVIDER_ROLE]

// --- Drag & Drop Payload ---

interface DragProviderData {
	kind: "provider"
	providerId: string
	providerType: ProviderRole
	providerName: string
	defaultCost: number
}

import type { CalendarViewEvent } from "./calendar.types"

interface DragEventData {
	kind: "event"
	eventId: string
	event: CalendarViewEvent
}

type DragPayload = DragProviderData | DragEventData

// --- Conflict Detection ---

interface ConflictingEventInfo {
	id: string
	tourName: string
	date: Date
	startTime: string | null
	endTime: string | null
}

interface ConflictInfo {
	providerId: string
	providerName: string
	providerType: ProviderRole
	conflictingEvent: ConflictingEventInfo
	targetEvent: ConflictingEventInfo
}

// --- Selection State ---

interface SelectionState {
	isSelectionMode: boolean
	selectedEventIds: Set<string>
}

// --- Assignment Context State ---

interface ProviderAssignmentState {
	selection: SelectionState
	isToolbarOpen: boolean
	activeConflicts: ConflictInfo[]
	pendingAssignment: {
		eventId: string
		providerId: string
		providerType: ProviderRole
		providerName: string
		defaultCost: number
	} | null
}

// --- Assignment Context Actions ---

type ProviderAssignmentAction =
	| { type: "TOGGLE_SELECTION_MODE" }
	| { type: "SELECT_EVENT"; eventId: string }
	| { type: "DESELECT_EVENT"; eventId: string }
	| { type: "SELECT_EVENTS"; eventIds: string[] }
	| { type: "CLEAR_SELECTION" }
	| { type: "TOGGLE_TOOLBAR" }
	| { type: "SET_CONFLICTS"; conflicts: ConflictInfo[] }
	| { type: "CLEAR_CONFLICTS" }
	| { type: "SET_PENDING_ASSIGNMENT"; assignment: ProviderAssignmentState["pendingAssignment"] }
	| { type: "CLEAR_PENDING_ASSIGNMENT" }

// --- Bulk Assignment Input ---

interface BulkAssignInput {
	eventIds: string[]
	guideId?: string | null
	driverId?: string | null
	vehicleId?: string | null
	guideCost?: number
	driverCost?: number
	vehicleCost?: number
}

export { PROVIDER_ROLE }
export type {
	ProviderRole,
	DragProviderData,
	DragEventData,
	DragPayload,
	ConflictingEventInfo,
	ConflictInfo,
	SelectionState,
	ProviderAssignmentState,
	ProviderAssignmentAction,
	BulkAssignInput,
}
