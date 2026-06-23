import type { CalendarViewEvent } from "../types/calendar.types"
import { getEventDisplayName } from "@/project/events/utils/event-display"
import { isSameCalendarDay } from "@/shared/utils/calendar-day"

export type ExportScope =
	| { kind: "day"; date: Date }
	| { kind: "tour"; tourName: string; date: Date }
	| { kind: "provider-type"; providerType: "guide" | "driver" | "vehicle"; date: Date }
	| { kind: "selection"; selectedIds: Set<string> }

export function filterEvents(
	events: CalendarViewEvent[],
	scope: ExportScope
): CalendarViewEvent[] {
	switch (scope.kind) {
		case "day":
			return events.filter((e) => isSameCalendarDay(e.date, scope.date))

		case "tour":
			return events.filter(
				(e) => isSameCalendarDay(e.date, scope.date) && getEventDisplayName(e) === scope.tourName
			)

		case "provider-type": {
			const { providerType, date } = scope
			return events.filter((e) => {
				if (!isSameCalendarDay(e.date, date)) return false
				if (providerType === "guide") return e.guideId != null
				if (providerType === "driver") return e.driverId != null
				if (providerType === "vehicle") return e.vehicleId != null
				return false
			})
		}

		case "selection":
			return events.filter((e) => scope.selectedIds.has(e.id))
	}
}
