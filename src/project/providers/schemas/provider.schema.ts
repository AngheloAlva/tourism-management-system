import { rutRegex } from "@/shared/lib/format-rut"
import { z } from "zod"

export const providerTypeEnum = z.enum(["NATURAL", "JURIDICA"])
export const giroEnum = z.enum(["EXENTO", "AFECTO"])

export const providerSchema = z
	.object({
		type: providerTypeEnum,
		rut: z.string().min(1, "El RUT es requerido").regex(rutRegex, "El RUT ingresado no es válido"),
		isActive: z.boolean(),

		fullName: z.string().optional(),
		address: z.string().optional(),
		phone: z.string().optional(),
		birthDate: z.date().optional(),
		email: z.string().email("Email inválido").optional().or(z.literal("")),

		companyName: z.string().optional(),
		category: z.string().optional(),
		giro: giroEnum.optional(),

		services: z.object({
			conductor: z.boolean(),
			maquina: z.boolean(),
			transferOut: z.boolean(),
			cocteleria: z.boolean(),
			conductorMaquina: z.boolean(),
			transferIn: z.boolean(),
			guia: z.boolean(),
			otros: z.boolean(),
		}),

		licenseType: z.string().optional(),
		licenseUrl: z.string().optional(),
		licenseRenovationDate: z.date().optional(),
		carnetUrl: z.string().optional(),
		carnetRenovationDate: z.date().optional(),

		sernaturRegistry: z.string().optional(),
		sernaturRenovationDate: z.date().optional(),

		// Datos Vehículo
		vehicleBrand: z.string().optional(),
		vehicleModel: z.string().optional(),
		vehicleYear: z.union([z.string(), z.number()]).optional(), // Permitir string o number en input
		vehiclePlate: z.string().optional(),
		vehicleCapacity: z.number().int().positive().optional(),
		mileage: z.string().optional(),
		vehicleEfficiency: z.string().optional(),

		// Documentación Vehículo
		technicalRevisionUrl: z.string().optional(),
		technicalRevisionDate: z.date().optional(),
		circulationPermitUrl: z.string().optional(),
		circulationPermitDate: z.date().optional(),
		decree80Url: z.string().optional(),
		decree80Date: z.date().optional(),

        otherDescription: z.string().optional(),
        costPerDay: z.number().nonnegative().optional(),
        guideCost: z.number().nonnegative().optional(),
        driverCost: z.number().nonnegative().optional(),
        vehicleCost: z.number().nonnegative().optional(),
        transferInCost: z.number().nonnegative().optional(),
        transferOutCost: z.number().nonnegative().optional(),
        otherCost: z.number().nonnegative().optional(),

		// Catering
		catering: z
			.array(
				z.object({
					cateringOptionId: z.string(),
					pricePerPerson: z.number().nonnegative(),
					pricingRules: z.string().optional(), // JSON stringificado
				})
			)
			.optional(),
	})
	.superRefine((data, ctx) => {
		if (data.type === "NATURAL") {
			if (!data.fullName)
				ctx.addIssue({
					code: "custom",
					path: ["fullName"],
					message: "El nombre completo es requerido",
				})
			if (!data.address)
				ctx.addIssue({ code: "custom", path: ["address"], message: "La dirección es requerida" })
			if (!data.phone)
				ctx.addIssue({ code: "custom", path: ["phone"], message: "El teléfono es requerido" })
			if (!data.birthDate)
				ctx.addIssue({
					code: "custom",
					path: ["birthDate"],
					message: "La fecha de nacimiento es requerida",
				})
		} else {
			if (!data.companyName)
				ctx.addIssue({
					code: "custom",
					path: ["companyName"],
					message: "El nombre de la empresa es requerido",
				})
			if (!data.category)
				ctx.addIssue({ code: "custom", path: ["category"], message: "La categoría es requerida" })
			if (!data.giro)
				ctx.addIssue({ code: "custom", path: ["giro"], message: "El giro es requerido" })
		}

		const isDriver = data.services.conductor || data.services.conductorMaquina

		if (isDriver) {
			if (!data.licenseType)
				ctx.addIssue({
					code: "custom",
					path: ["licenseType"],
					message: "El tipo de licencia es requerido",
				})
			if (!data.carnetRenovationDate)
				ctx.addIssue({
					code: "custom",
					path: ["carnetRenovationDate"],
					message: "La fecha de renovación del carnet es requerida",
				})
			if (!data.licenseRenovationDate)
				ctx.addIssue({
					code: "custom",
					path: ["licenseRenovationDate"],
					message: "La fecha de renovación de la licencia es requerida",
				})
		}
	})

export type ProviderFormData = z.infer<typeof providerSchema>
