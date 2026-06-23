import { IS_DEMO } from "./demo"

const PRODUCTION_COMPANY_INFO = {
	name: "TurismoChileTours",
	rut: "77.504.164-1",
	sernatur: "61891",
	address: "San Pedro de Atacama, Chile", // Placeholder — reemplazar con datos reales
	phone: "+56 XX XXXX XXXX", // Placeholder — reemplazar con datos reales
	email: "info@turismochiletours.cl", // Placeholder — reemplazar con datos reales
	logoUrl: process.env.NEXT_PUBLIC_BASE_URL
		? `${process.env.NEXT_PUBLIC_BASE_URL}/full-logo.png`
		: "/full-logo.png",
} as const

/**
 * Fictional brand used in demo mode.
 * All values here are invented — no real company data.
 */
const DEMO_COMPANY_INFO = {
	name: "Atacama Demo Tours",
	rut: "00.000.000-0",
	sernatur: "00000",
	address: "Calle Imaginaria 123, San Pedro de Atacama, Chile",
	phone: "+56 55 000 0000",
	email: "info@atacama-demo.cl",
	logoUrl: process.env.NEXT_PUBLIC_BASE_URL
		? `${process.env.NEXT_PUBLIC_BASE_URL}/full-logo.png`
		: "/full-logo.png",
} as const

export const COMPANY_INFO = IS_DEMO ? DEMO_COMPANY_INFO : PRODUCTION_COMPANY_INFO

export type CompanyInfo = typeof PRODUCTION_COMPANY_INFO
