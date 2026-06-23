import type { DIET_TYPE, SALE_MODE } from "@/generated/prisma/enums"

// --- View Mode ---

const VIEW_MODE = {
	DAY: "day",
	WEEK: "week",
	MONTH: "month",
	PROVIDER: "provider",
} as const

type ViewMode = (typeof VIEW_MODE)[keyof typeof VIEW_MODE]

// --- Assignment Filter ---

const ASSIGNMENT_FILTER = {
	ALL: "all",
	MISSING_GUIDE: "missing-guide",
	MISSING_DRIVER: "missing-driver",
	MISSING_VEHICLE: "missing-vehicle",
	COMPLETE: "complete",
	ANY_MISSING: "any-missing",
} as const

type AssignmentFilterValue = (typeof ASSIGNMENT_FILTER)[keyof typeof ASSIGNMENT_FILTER]

// --- Passenger ---

interface PassengerHotelData {
	id: string
	hotelName: string
	checkIn: Date | null
	checkOut: Date | null
	order: number
}

interface Passenger {
	id: string
	name: string | null
	document: string | null
	nationality: string | null
	phone: string | null
	age: number | null
	diet: DIET_TYPE | null
	dietOther: string | null
	allergies: string[]
	hotels: PassengerHotelData[]
}

// --- Booking Passenger (per-tour exclusion) ---

interface BookingPassengerData {
	id: string
	passengerId: string
	excluded: boolean
	excludeReason: string | null
	passenger: Passenger
}

// --- Calendar View Event ---

interface CalendarViewEvent {
	id: string
	date: Date
	serviceKind: "TOUR" | "TRANSFER"
	status: string
	mode: SALE_MODE
	endTime: string | null
	startTime: string | null
	tourId: string | null
	maxCapacity: number
	currentBookings?: number
	tour: { name: string } | null
	transferService: { id: string; name: string } | null
	bookings?: Array<{
		saleRecordId: string
		passengerCount: number
		saleRecord?: {
			passengers: Passenger[]
			customerVoucherEmailSentAt?: Date | null
			voucher?: number | null
			seller?: { name: string } | null
			wholesaleAgency?: { name: string } | null
		}
		bookingPassengers?: BookingPassengerData[]
	}>
	_count?: {
		transfers?: number
	}
	guideId: string | null
	driverId: string | null
	vehicleId: string | null
	guide?: { fullName: string | null } | null
	driver?: { fullName: string | null } | null
	vehicle?: {
		vehicleBrand: string | null
		vehicleModel: string | null
		vehiclePlate: string | null
	} | null
	operationalNotes?: string | null
	comments?: string | null
}

// --- Completitud Metrics ---

interface CompletitudMetrics {
	complete: number
	total: number
	percentage: number
}

interface DailyCompletitud {
	date: Date
	dateStr: string
	complete: number
	total: number
	percentage: number
	incompleteEvents: CalendarViewEvent[]
}

// --- Missing Assignment Role ---

const MISSING_ROLE = {
	GUIDE: "guide",
	DRIVER: "driver",
	VEHICLE: "vehicle",
} as const

type MissingRole = (typeof MISSING_ROLE)[keyof typeof MISSING_ROLE]

interface IncompleteEventInfo {
	event: CalendarViewEvent
	missing: MissingRole[]
}

interface UseCompletitudReturn {
	overall: CompletitudMetrics
	dailyBreakdown: DailyCompletitud[]
	incompleteEvents: IncompleteEventInfo[]
}

// --- PDF Data Types ---

interface PdfPassengerData {
	name: string
	hotel: string
	phone: string
	nationality: string
	document: string
	age: string
	allergies: string
	diet: string
}

interface PdfEventData {
	tourName: string
	date: string
	startTime: string
	endTime: string
	mode: string
	guideName: string
	driverName: string
	vehicleInfo: string
	passengers: PdfPassengerData[]
	passengerCount: number
	notes: string
}

interface DailyRoutePdfProps {
	date: string
	events: PdfEventData[]
	totalPassengers: number
}

// --- View-Specific Props ---

interface SelectionProps {
	isSelectionMode?: boolean
	selectedEventIds?: Set<string>
	onSelectEvent?: (eventId: string) => void
}

interface CalendarViewBaseProps {
	events: CalendarViewEvent[]
	selectedDate: Date
	onEventClick: (eventId: string) => void
	conflictingEventIds?: Set<string>
}

interface GroupableViewProps {
	grouped?: boolean
	/** Legacy bulk assign for selection-mode toolbar (BulkAssignmentDialog). Keep for CalendarPageContent. */
	onBulkAssign?: (eventIds: string[], roleScope: "all" | "transfer") => void
	/** Group-card assign callback; replaces onBulkAssign for the grouped-card path. */
	onGroupAssign?: (row: import("../utils/tour-summary-groups").CollapsedGroupRow) => void
}

interface CalendarMonthViewProps extends CalendarViewBaseProps, SelectionProps, GroupableViewProps {
	onDayClick: (date: Date) => void
}

interface CalendarWeekViewProps extends CalendarViewBaseProps, SelectionProps, GroupableViewProps {
	onDayClick: (date: Date) => void
}

interface CalendarDayViewProps extends CalendarViewBaseProps, SelectionProps, GroupableViewProps {}

// --- Header Props ---

interface CalendarViewHeaderProps {
	viewMode: ViewMode
	selectedDate: Date
	onPrev: () => void
	onNext: () => void
	onToday: () => void
	onViewModeChange: (mode: ViewMode) => void
	grouped?: boolean
	onGroupedChange?: (value: boolean) => void
}

// --- Event Card Props ---

const EVENT_CARD_VARIANT = {
	COMPACT: "compact",
	EXPANDED: "expanded",
} as const

type EventCardVariant = (typeof EVENT_CARD_VARIANT)[keyof typeof EVENT_CARD_VARIANT]

interface CalendarEventCardProps {
	event: CalendarViewEvent
	variant: EventCardVariant
	onClick: () => void
	isSelected?: boolean
	isSelectionMode?: boolean
	isConflicting?: boolean
	onSelect?: (eventId: string) => void
}

export { VIEW_MODE, ASSIGNMENT_FILTER, EVENT_CARD_VARIANT, MISSING_ROLE }
export type {
	ViewMode,
	AssignmentFilterValue,
	PassengerHotelData,
	Passenger,
	BookingPassengerData,
	CalendarViewEvent,
	CalendarViewBaseProps,
	CalendarMonthViewProps,
	CalendarWeekViewProps,
	CalendarDayViewProps,
	CalendarViewHeaderProps,
	CalendarEventCardProps,
	EventCardVariant,
	SelectionProps,
	GroupableViewProps,
	CompletitudMetrics,
	DailyCompletitud,
	MissingRole,
	IncompleteEventInfo,
	UseCompletitudReturn,
	PdfPassengerData,
	PdfEventData,
	DailyRoutePdfProps,
}
