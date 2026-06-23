"use server"

import { headers } from "next/headers"

import { providerSchema } from "../schemas/provider.schema"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"
import { requestApproval } from "@/project/approvals/actions/approval.actions"
import { computeFingerprint } from "@/project/approvals/utils/fingerprint"
import { buildSnapshot } from "@/project/approvals/utils/snapshot"
import { APPROVAL_ACTION } from "@/generated/prisma/enums"
import { parseCalendarDay, formatCalendarDay } from "@/shared/utils/calendar-day"

// Normalize a form-supplied Date (local midnight from date picker) to UTC midnight
// so it is stored correctly in a @db.Date column, independent of server timezone.
function normalizeDate(d: Date | undefined | null): Date | undefined {
  if (!d) return undefined
  return parseCalendarDay(formatCalendarDay(d, "yyyy-MM-dd"))
}

import type { ProviderFormData } from "../schemas/provider.schema"
import type { Prisma } from "@/generated/prisma/client"

export type ProviderWithCatering = Prisma.ProviderGetPayload<{
    include: { catering: { include: { cateringOption: true } } }
}>

async function getAuthUser() {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (!session?.user) {
		throw new Error("No autenticado")
	}

	return session.user
}

async function requireProviderInteraction() {
	const canInteract = await canCurrentUserInteractPath("/control-de-proveedores")
	if (!canInteract) throw new Error("No tiene permisos para modificar proveedores")
}

export interface ProviderSummary {
	total: number
	active: number
	guides: number
	drivers: number
	vehicles: number
}

export async function getProviders() {
	try {
		await getAuthUser()
		const providers = await prisma.provider.findMany({
			orderBy: { createdAt: "desc" },
			include: {
				catering: {
					include: {
						cateringOption: true,
					},
				},
			},
		})
		return { success: true, data: providers }
	} catch (error) {
		console.error("Error fetching providers:", error)
		return { success: false, error: "Error al obtener los proveedores" }
	}
}

export async function getProviderById(id: string) {
	try {
		await getAuthUser()
		const provider = await prisma.provider.findUnique({
			where: { id },
		})

		if (!provider) {
			return { success: false, error: "Proveedor no encontrado" }
		}

		return { success: true, data: provider }
	} catch (error) {
		console.error("Error fetching provider:", error)
		return { success: false, error: "Error al obtener el proveedor" }
	}
}

export async function getProvidersSummary() {
	try {
		await getAuthUser()

		const [total, active, guides, drivers, vehicles] = await Promise.all([
			prisma.provider.count(),
			prisma.provider.count({ where: { isActive: true } }),
			prisma.provider.count({ where: { guia: true } }),
			prisma.provider.count({ where: { OR: [{ conductor: true }, { conductorMaquina: true }] } }),
			prisma.provider.count({ where: { OR: [{ maquina: true }, { conductorMaquina: true }] } }),
		])

		const summary: ProviderSummary = {
			total,
			active,
			guides,
			drivers,
			vehicles,
		}

		return { success: true, data: summary }
	} catch (error) {
		console.error("Error fetching providers summary:", error)
		return { success: false, error: "Error al obtener el resumen de proveedores" }
	}
}

export async function createProvider(data: ProviderFormData) {
	try {
		await getAuthUser()
		await requireProviderInteraction()
		const validatedData = providerSchema.parse(data)

		const provider = await prisma.provider.create({
			data: {
				type: validatedData.type,
				rut: validatedData.rut,
				isActive: validatedData.isActive,

				// Persona Natural
				fullName: validatedData.fullName,
				birthDate: normalizeDate(validatedData.birthDate),

				// Persona Jurídica
				companyName: validatedData.companyName,
				category: validatedData.category,
				giro: validatedData.giro,

				// Común
				address: validatedData.address,
				phone: validatedData.phone,
				email: validatedData.email,

				// Servicios
				conductor: validatedData.services.conductor,
				maquina: validatedData.services.maquina,
				transferOut: validatedData.services.transferOut,
				cocteleria: validatedData.services.cocteleria,
				conductorMaquina: validatedData.services.conductorMaquina,
				transferIn: validatedData.services.transferIn,
				guia: validatedData.services.guia,
				otros: validatedData.services.otros,

				// Conductor
				licenseType: validatedData.licenseType,
				licenseUrl: validatedData.licenseUrl,
				licenseRenovationDate: normalizeDate(validatedData.licenseRenovationDate),
				carnetUrl: validatedData.carnetUrl,
				carnetRenovationDate: normalizeDate(validatedData.carnetRenovationDate),

				// Guía
				sernaturRegistry: validatedData.sernaturRegistry,
				sernaturRenovationDate: normalizeDate(validatedData.sernaturRenovationDate),

				// Vehículo
				// Vehículo
				vehicleBrand: validatedData.vehicleBrand,
				vehicleModel: validatedData.vehicleModel,
				vehicleYear: validatedData.vehicleYear
					? parseInt(validatedData.vehicleYear.toString())
					: null,
				vehiclePlate: validatedData.vehiclePlate,
				vehicleCapacity: validatedData.vehicleCapacity,
				mileage: validatedData.mileage,
				vehicleEfficiency: validatedData.vehicleEfficiency,

				// Documentación Vehículo
				technicalRevisionUrl: validatedData.technicalRevisionUrl,
				technicalRevisionDate: normalizeDate(validatedData.technicalRevisionDate),
				circulationPermitUrl: validatedData.circulationPermitUrl,
				circulationPermitDate: normalizeDate(validatedData.circulationPermitDate),
				decree80Url: validatedData.decree80Url,
				decree80Date: normalizeDate(validatedData.decree80Date),

                // Otros
                otherDescription: validatedData.otherDescription,
                costPerDay: validatedData.costPerDay || 0,
                guideCost: validatedData.guideCost || 0,
                driverCost: validatedData.driverCost || 0,
                vehicleCost: validatedData.vehicleCost || 0,
                transferInCost: validatedData.transferInCost || 0,
                transferOutCost: validatedData.transferOutCost || 0,
                otherCost: validatedData.otherCost || 0,

				// Catering
				catering: validatedData.catering
					? {
							create: validatedData.catering.map((item) => ({
								cateringOptionId: item.cateringOptionId,
								pricePerPerson: item.pricePerPerson,
								pricingRules: item.pricingRules ? JSON.parse(item.pricingRules) : undefined,
							})),
						}
					: undefined,
			},
		})

		return { success: true, data: provider }
	} catch (error) {
		console.error("Error creating provider:", error)
		if (error instanceof Error) {
			return { success: false, error: error.message }
		}
		return { success: false, error: "Error al crear el proveedor" }
	}
}

export async function updateProvider(id: string, data: ProviderFormData) {
	try {
		await getAuthUser()
		await requireProviderInteraction()
		const validatedData = providerSchema.parse(data)

		const provider = await prisma.provider.update({
			where: { id },
			data: {
				type: validatedData.type,
				rut: validatedData.rut,
				isActive: validatedData.isActive,

				// Persona Natural
				fullName: validatedData.fullName,
				birthDate: normalizeDate(validatedData.birthDate),

				// Persona Jurídica
				companyName: validatedData.companyName,
				category: validatedData.category,
				giro: validatedData.giro,

				// Común
				address: validatedData.address,
				phone: validatedData.phone,
				email: validatedData.email,

				// Servicios
				conductor: validatedData.services.conductor,
				maquina: validatedData.services.maquina,
				transferOut: validatedData.services.transferOut,
				cocteleria: validatedData.services.cocteleria,
				conductorMaquina: validatedData.services.conductorMaquina,
				transferIn: validatedData.services.transferIn,
				guia: validatedData.services.guia,
				otros: validatedData.services.otros,

				// Conductor
				licenseType: validatedData.licenseType,
				licenseUrl: validatedData.licenseUrl,
				licenseRenovationDate: normalizeDate(validatedData.licenseRenovationDate),
				carnetUrl: validatedData.carnetUrl,
				carnetRenovationDate: normalizeDate(validatedData.carnetRenovationDate),

				// Guía
				sernaturRegistry: validatedData.sernaturRegistry,
				sernaturRenovationDate: normalizeDate(validatedData.sernaturRenovationDate),

				// Vehículo
				// Vehículo
				vehicleBrand: validatedData.vehicleBrand,
				vehicleModel: validatedData.vehicleModel,
				vehicleYear: validatedData.vehicleYear
					? parseInt(validatedData.vehicleYear.toString())
					: null,
				vehiclePlate: validatedData.vehiclePlate,
				vehicleCapacity: validatedData.vehicleCapacity,
				mileage: validatedData.mileage,
				vehicleEfficiency: validatedData.vehicleEfficiency,

				// Documentación Vehículo
				technicalRevisionUrl: validatedData.technicalRevisionUrl,
				technicalRevisionDate: normalizeDate(validatedData.technicalRevisionDate),
				circulationPermitUrl: validatedData.circulationPermitUrl,
				circulationPermitDate: normalizeDate(validatedData.circulationPermitDate),
				decree80Url: validatedData.decree80Url,
				decree80Date: normalizeDate(validatedData.decree80Date),

                // Otros
                otherDescription: validatedData.otherDescription,
                costPerDay: validatedData.costPerDay || 0,
                guideCost: validatedData.guideCost || 0,
                driverCost: validatedData.driverCost || 0,
                vehicleCost: validatedData.vehicleCost || 0,
                transferInCost: validatedData.transferInCost || 0,
                transferOutCost: validatedData.transferOutCost || 0,
                otherCost: validatedData.otherCost || 0,

				// Catering
				catering: validatedData.catering
					? {
							deleteMany: {},
							create: validatedData.catering.map((item) => ({
								cateringOptionId: item.cateringOptionId,
								pricePerPerson: item.pricePerPerson,
								pricingRules: item.pricingRules ? JSON.parse(item.pricingRules) : undefined,
							})),
						}
					: undefined,
			},
		})

		return { success: true, data: provider }
	} catch (error) {
		console.error("Error updating provider:", error)
		if (error instanceof Error) {
			return { success: false, error: error.message }
		}
		return { success: false, error: "Error al actualizar el proveedor" }
	}
}

export async function deleteProvider(
  id: string,
  reason: string
): Promise<
  | { success: true; approvalRequired: boolean; requestId?: string }
  | { success: false; error: string }
> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { success: false, error: "No autorizado" }

  const canInteract = await canCurrentUserInteractPath("/control-de-proveedores")
  if (!canInteract) return { success: false, error: "No tiene permisos para esta acción" }

  try {
    const provider = await prisma.provider.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        companyName: true,
        type: true,
        isActive: true,
        updatedAt: true,
      },
    })

    if (!provider) return { success: false, error: "Proveedor no encontrado" }

    const providerName =
      provider.type === "NATURAL"
        ? (provider.fullName ?? "Sin nombre")
        : (provider.companyName ?? "Sin nombre")

    const fingerprint = computeFingerprint(provider)
    const snapshot = buildSnapshot("providers", {
      id: provider.id,
      name: providerName,
      active: provider.isActive,
    })

    const result = await requestApproval({
      action: APPROVAL_ACTION.DELETE_PROVIDER,
      targetType: "provider",
      targetId: id,
      payload: { reason: reason.trim() },
      reason: reason.trim(),
      targetFingerprint: fingerprint,
      snapshot,
      source: { path: "/dashboard/control-de-proveedores", ui: "delete-provider-dialog" },
    })

    if ("error" in result) {
      return { success: false, error: result.message }
    }

    return {
      success: true,
      approvalRequired: result.approvalRequired,
      requestId: result.approvalRequired ? result.requestId : undefined,
    }
  } catch (error) {
    console.error("Error requesting provider deletion:", error)
    return { success: false, error: "Error al solicitar la eliminación del proveedor" }
  }
}

export async function toggleProviderStatus(id: string, active: boolean) {
	try {
		await getAuthUser()
		await requireProviderInteraction()
		const provider = await prisma.provider.update({
			where: { id },
			data: { isActive: active },
		})
		return { success: true, data: provider }
	} catch (error) {
		console.error("Error toggling provider status:", error)
		return { success: false, error: "Error al cambiar el estado del proveedor" }
	}
}

export async function getCateringOptions() {
	try {
		await getAuthUser()
		const options = await prisma.cateringOption.findMany({
			where: { active: true },
			orderBy: { name: "asc" },
		})
		return { success: true, data: options }
	} catch (error) {
		console.error("Error fetching catering options:", error)
		return { success: false, error: "Error al obtener opciones de catering" }
	}
}

export async function createCateringOption(name: string) {
	try {
		await getAuthUser()
		await requireProviderInteraction()
		const option = await prisma.cateringOption.create({
			data: { name, active: true },
		})
		return { success: true, data: option }
	} catch (error) {
		console.error("Error creating catering option:", error)
		return { success: false, error: "Error al crear la opción de catering" }
	}
}
