export const COMPANY_INFO = {
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

export type CompanyInfo = typeof COMPANY_INFO
