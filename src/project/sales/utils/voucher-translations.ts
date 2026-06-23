export type Language = "es" | "en" | "pt"

export interface VoucherTranslations {
	voucher: string
	agency: string
	contact: string
	passengers: string
	name: string
	document: string
	phone: string
	hotel: string
	nationality: string
	age: string
	tourDate: string
	tour: string
	start: string
	end: string
	flight: string
	entrances: string
	totalAmount: string
	total: string
	private: string
	emergencyTitle: string
	emergencyPhone: string
	emergencyEmail: string
	conditionsTitle: string
	conditionTransferIn: string
	conditionTransferOut: string
	monday: string
	tuesday: string
	wednesday: string
	thursday: string
	friday: string
	saturday: string
	sunday: string
	// Detalles de tours
	tourDetails: string
	summary: string
	schedule: string
	includes: string
	pickup: string
	whatToBring: string
	altitude: string
}

export const translations: Record<Language, VoucherTranslations> = {
	es: {
		voucher: "VOUCHER",
		agency: "Agencia",
		contact: "Contacto",
		passengers: "Pasajeros",
		name: "Nombre",
		document: "Documento",
		phone: "Teléfono",
		hotel: "Hotel",
		nationality: "Nacionalidad",
		age: "Edad",
		tourDate: "Fecha Tour",
		tour: "Tour",
		start: "Inicio",
		end: "Término",
		flight: "Vuelo",
		entrances: "Entradas",
		totalAmount: "Monto Total",
		total: "TOTAL",
		private: "Privado",
		emergencyTitle: "Para emergencias o consultas:",
		emergencyPhone: "Teléfono: +569 8989 0901 (WhatsApp disponible)",
		emergencyEmail: "Email: contacto@turismochiletours.com",
		conditionsTitle: "Condiciones importantes:",
		conditionTransferIn:
			"• Para transfers IN te estaremos esperando con un cartel con tu nombre a la salida del aeropuerto.",
		conditionTransferOut:
			"• Para transfers OUT el horario de pick up en tu hotel es al menos con 4 horas de anticipación al vuelo, para que te vayas organizando con la hora de salida, te enviaremos un ejecutivo con WhatsApp un día antes de la salida.",
		monday: "lunes",
		tuesday: "martes",
		wednesday: "miércoles",
		thursday: "jueves",
		friday: "viernes",
		saturday: "sábado",
		sunday: "domingo",
		tourDetails: "Detalles del Tour",
		summary: "Resumen General",
		schedule: "Itinerario",
		includes: "Incluye",
		pickup: "Punto de Encuentro",
		whatToBring: "Qué Traer",
		altitude: "Información de Altitud",
	},
	en: {
		voucher: "VOUCHER",
		agency: "Agency",
		contact: "Contact",
		passengers: "Passengers",
		name: "Name",
		document: "Document",
		phone: "Phone",
		hotel: "Hotel",
		nationality: "Nationality",
		age: "Age",
		tourDate: "Tour Date",
		tour: "Tour",
		start: "Start",
		end: "End",
		flight: "Flight",
		entrances: "Entrance Fees",
		totalAmount: "Total Amount",
		total: "TOTAL",
		private: "Private",
		emergencyTitle: "For emergencies or inquiries:",
		emergencyPhone: "Phone: +569 8989 0901 (WhatsApp available)",
		emergencyEmail: "Email: contacto@turismochiletours.com",
		conditionsTitle: "Important conditions:",
		conditionTransferIn:
			"• For IN transfers, we will be waiting for you with a sign with your name at the airport exit.",
		conditionTransferOut:
			"• For OUT transfers, the pick-up time at your hotel is at least 4 hours before the flight. To help you organize your departure time, we will send you an executive via WhatsApp one day before departure.",
		monday: "Monday",
		tuesday: "Tuesday",
		wednesday: "Wednesday",
		thursday: "Thursday",
		friday: "Friday",
		saturday: "Saturday",
		sunday: "Sunday",
		tourDetails: "Tour Details",
		summary: "General Summary",
		schedule: "Itinerary",
		includes: "Includes",
		pickup: "Meeting Point",
		whatToBring: "What to Bring",
		altitude: "Altitude Information",
	},
	pt: {
		voucher: "VOUCHER",
		agency: "Agência",
		contact: "Contato",
		passengers: "Passageiros",
		name: "Nome",
		document: "Documento",
		phone: "Telefone",
		hotel: "Hotel",
		nationality: "Nacionalidade",
		age: "Idade",
		tourDate: "Data do Tour",
		tour: "Tour",
		start: "Início",
		end: "Fim",
		flight: "Voo",
		entrances: "Ingressos",
		totalAmount: "Valor Total",
		total: "TOTAL",
		private: "Privado",
		emergencyTitle: "Para emergências ou consultas:",
		emergencyPhone: "Telefone: +569 8989 0901 (WhatsApp disponível)",
		emergencyEmail: "Email: contacto@turismochiletours.com",
		conditionsTitle: "Condições importantes:",
		conditionTransferIn:
			"• Para transfers IN, estaremos esperando por você com uma placa com seu nome na saída do aeroporto.",
		conditionTransferOut:
			"• Para transfers OUT, o horário de pick-up no seu hotel é pelo menos 4 horas antes do voo. Para ajudá-lo a organizar seu horário de saída, enviaremos um executivo via WhatsApp um dia antes da partida.",
		monday: "segunda-feira",
		tuesday: "terça-feira",
		wednesday: "quarta-feira",
		thursday: "quinta-feira",
		friday: "sexta-feira",
		saturday: "sábado",
		sunday: "domingo",
		tourDetails: "Detalhes do Tour",
		summary: "Resumo Geral",
		schedule: "Itinerário",
		includes: "Inclui",
		pickup: "Ponto de Encontro",
		whatToBring: "O Que Trazer",
		altitude: "Informação de Altitude",
	},
}

export function getTranslations(language: Language): VoucherTranslations {
	return translations[language] || translations.es
}
