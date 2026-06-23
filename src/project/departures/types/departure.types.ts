export interface DepartureEvent {
	id: string
	date: Date
	startTime: string | null
	endTime: string | null
	mode: "REGULAR" | "PRIVATE"
	serviceKind: "TOUR" | "TRANSFER"
	status: string
	currentBookings: number
	maxCapacity: number
	tour: {
		id: string
		name: string
	} | null
	transferService: {
		id: string
		name: string
	} | null
	bookings: Array<{
		id: string
		passengerCount: number
		adultsCount: number
		childrenCount: number
		seniorsCount: number
		specialRequest: string | null
		saleRecord: {
			id: string
			voucher: number
			type: "SALE" | "QUOTE"
			channel: string
			clientEmail: string | null
			seller: {
				id: string
				name: string
			}
			passengers: Array<{
				id: string
				name: string | null
				age: number | null
			}>
		}
		bookingPassengers?: Array<{
			passengerId: string
			excluded: boolean
		}>
	}>
	guide: {
		fullName: string | null
	} | null
	driver: {
		fullName: string | null
	} | null
	vehicle: {
		vehicleBrand: string | null
		vehicleModel: string | null
		vehiclePlate: string | null
	} | null
	cateringProvider: {
		fullName: string | null
		companyName: string | null
	} | null
}
