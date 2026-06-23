import { getEvents } from "@/project/events/actions/event.actions"

import { CalendarPageContent } from "@/project/calendar/components/calendar-page-content"

export const dynamic = "force-dynamic"

export default async function CalendarPage() {
	const startDate = new Date()
	startDate.setMonth(startDate.getMonth() - 2)
	const endDate = new Date()
	endDate.setMonth(endDate.getMonth() + 2)

	const events = await getEvents(startDate, endDate)
	const calendarEvents = events
		.filter((event) => Boolean(event.tour))
		.map((event) => ({
			...event,
			tour: event.tour || { name: "Transfer" },
		}))

	// TODO: Cuando se quiere traspasar pasajeros que te lleve a la pagina de transpaos con los campos ya completados

	return <CalendarPageContent events={calendarEvents} />
}
