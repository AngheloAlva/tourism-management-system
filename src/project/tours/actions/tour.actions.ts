"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { createTourSchema, updateTourSchema } from "../schemas/tour.schema"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"

import type { CreateTour, UpdateTour } from "../schemas/tour.schema"
import { DEFAULT_PRICE_CATEGORIES } from "../constants/default-price-categories"

async function getAuthUser() {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session?.user) throw new Error("No autenticado")
	return session.user
}

async function requireTourInteraction() {
	const canInteract = await canCurrentUserInteractPath("/tours")
	if (!canInteract) throw new Error("No tiene permisos para modificar tours")
}

export interface TourSummary {
	totalTours: number
	activeTours: number
	totalRegularTours: number
	totalTransfers: number
}

// ─── Types ────────────────────────────────────────────────────────────────────

const ACTIVE_TOUR_PRICE_CATEGORY_SOURCE = {
	TOUR: "tour",
	TRANSFER: "transfer",
} as const

export type ActiveTourPriceCategorySource =
	(typeof ACTIVE_TOUR_PRICE_CATEGORY_SOURCE)[keyof typeof ACTIVE_TOUR_PRICE_CATEGORY_SOURCE]

export interface ActiveTourEntry {
	id: string
	name: string
	variantName: string
	price: number
	isDefault: boolean
	isSpecial: boolean
	sortOrder: number
}

export interface ActiveTourPriceCategory {
	id: string
	name: string
	price: number
	transferPrice: number
	receptionPrice: number
	minPrice: number | null
	maxPrice: number | null
	ageMin: number | null
	ageMax: number | null
	isDefault: boolean
	isSpecial: boolean
	sortOrder: number
	entries: ActiveTourEntry[]
	source: ActiveTourPriceCategorySource
}

export interface ActiveTour {
	id: string
	name: string
	serviceKind: "TOUR" | "TRANSFER"
	direction?: "IN" | "OUT"
	priceCategories: ActiveTourPriceCategory[]
	startTime: string | null
	endTime: string | null
	privatePriceTiers?: { capacity: number; price: number; entryPrice: number }[] | null
	privatePricing?: { capacity: number; price: number; entryPrice: number }[] | null
}

export interface TourWithDerivedPricing {
	id: string
	name: string
	description: string | null
	recommendations: string | null
	maxCapacity: number
	startTime: string | null
	endTime: string | null
	websiteUrl: string | null
	imageUrl: string | null
	generalSummaryEs: string | null
	generalSummaryEn: string | null
	generalSummaryPt: string | null
	scheduleEs: string | null
	scheduleEn: string | null
	schedulePt: string | null
	includesEs: string | null
	includesEn: string | null
	includesPt: string | null
	pickupEs: string | null
	pickupEn: string | null
	pickupPt: string | null
	whatToBringEs: string | null
	whatToBringEn: string | null
	whatToBringPt: string | null
	altitudeEs: string | null
	altitudeEn: string | null
	altitudePt: string | null
	active: boolean
	priceCategories: ActiveTourPriceCategory[]
	privatePriceTiers: { capacity: number; price: number; entryPrice: number }[]
	privatePricing: { capacity: number; price: number; entryPrice: number }[]
}

export interface TransferServiceItem {
	id: string
	name: string
	direction: "IN" | "OUT"
	pricePerPassenger: number
	receptionPricePerPassenger: number
	active: boolean
}

export async function getAllTours() {
	try {
		const tours = await prisma.tour.findMany({
			include: {
				privatePriceTiers: { orderBy: { capacity: "asc" } },
				priceCategories: {
					orderBy: { sortOrder: "asc" },
					include: { entries: { orderBy: { sortOrder: "asc" } } },
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		})

		const normalizedTours = tours.map((tour) => {
			const normalizedPrivatePriceTiers = tour.privatePriceTiers.map((tier) => ({
				capacity: tier.capacity,
				price: tier.price,
				entryPrice: tier.entryPrice,
			}))

			return {
				...tour,
				priceCategories: tour.priceCategories.map((pc) => ({
					...pc,
					source: ACTIVE_TOUR_PRICE_CATEGORY_SOURCE.TOUR,
				})),
				privatePriceTiers: normalizedPrivatePriceTiers,
				privatePricing: normalizedPrivatePriceTiers,
			}
		})

		return {
			success: true,
			data: normalizedTours,
		}
	} catch (error) {
		console.error("Error fetching tours:", error)
		return {
			success: false,
			error: "Error al obtener los tours",
		}
	}
}

export async function getTourById(
	id: string
): Promise<{ success: boolean; data: TourWithDerivedPricing | null; error?: string }> {
	try {
		const tour = await prisma.tour.findFirst({
			where: { id },
			include: {
				privatePriceTiers: {
					orderBy: { capacity: "asc" },
				},
				priceCategories: {
					orderBy: { sortOrder: "asc" },
					include: { entries: { orderBy: { sortOrder: "asc" } } },
				},
			},
		})

		if (!tour) {
			return {
				data: null,
				success: false,
				error: "Tour no encontrado",
			}
		}

		const normalizedPrivatePriceTiers = tour.privatePriceTiers.map((tier) => ({
			capacity: tier.capacity,
			price: tier.price,
			entryPrice: tier.entryPrice,
		}))

		const normalizedTour: TourWithDerivedPricing = {
			...tour,
			priceCategories: tour.priceCategories.map((pc) => ({
				...pc,
				source: ACTIVE_TOUR_PRICE_CATEGORY_SOURCE.TOUR,
			})),
			privatePriceTiers: normalizedPrivatePriceTiers,
			privatePricing: normalizedPrivatePriceTiers,
		}

		return {
			success: true,
			data: normalizedTour,
		}
	} catch (error) {
		console.error("Error fetching tour:", error)
		return {
			data: null,
			success: false,
			error: "Error al obtener el tour",
		}
	}
}

export async function getActiveTours() {
	try {
		const tours = await prisma.tour.findMany({
			where: { active: true },
			orderBy: { name: "asc" },
			select: {
				id: true,
				name: true,
				startTime: true,
				endTime: true,
				privatePriceTiers: {
					orderBy: { capacity: "asc" },
					select: {
						capacity: true,
						price: true,
						entryPrice: true,
					},
				},
				priceCategories: {
					where: { active: true },
					orderBy: { sortOrder: "asc" },
					select: {
						id: true,
						name: true,
						price: true,
						transferPrice: true,
						receptionPrice: true,
						minPrice: true,
						maxPrice: true,
						ageMin: true,
						ageMax: true,
						isDefault: true,
						isSpecial: true,
						sortOrder: true,
						entries: {
							where: { active: true },
							orderBy: { sortOrder: "asc" },
							select: {
								id: true,
								name: true,
								variantName: true,
								price: true,
								isDefault: true,
								isSpecial: true,
								sortOrder: true,
							},
						},
					},
				},
			},
		})

		const transferServices = await prisma.transferService.findMany({
			where: { active: true },
			orderBy: { name: "asc" },
			select: {
				id: true,
				name: true,
				direction: true,
				pricePerPassenger: true,
				receptionPricePerPassenger: true,
			},
		})

		const mappedTransferServices: ActiveTour[] = transferServices.map(
			(service: {
				id: string
				name: string
				direction: "IN" | "OUT"
				pricePerPassenger: number
				receptionPricePerPassenger: number
			}) => ({
				id: service.id,
				name: service.name,
				serviceKind: "TRANSFER",
				direction: service.direction,
				priceCategories: [
					{
						id: `transfer-${service.id}`,
						name: "Pasajero",
						price: service.pricePerPassenger,
						transferPrice: 0,
						receptionPrice: service.receptionPricePerPassenger,
						minPrice: null,
						maxPrice: null,
						ageMin: null,
						ageMax: null,
						isDefault: true,
						isSpecial: false,
						sortOrder: 0,
						entries: [],
						source: ACTIVE_TOUR_PRICE_CATEGORY_SOURCE.TRANSFER,
					},
				],
				startTime: null,
				endTime: null,
				privatePricing: null,
			})
		)

		const mappedTours: ActiveTour[] = tours.map((tour) => ({
			id: tour.id,
			name: tour.name,
			serviceKind: "TOUR",
			priceCategories: tour.priceCategories.map((pc) => ({
				...pc,
				source: ACTIVE_TOUR_PRICE_CATEGORY_SOURCE.TOUR,
			})),
			startTime: tour.startTime,
			endTime: tour.endTime,
			privatePriceTiers: tour.privatePriceTiers,
			privatePricing: tour.privatePriceTiers,
		}))

		const catalogItems = [...mappedTours, ...mappedTransferServices].sort((a, b) =>
			a.name.localeCompare(b.name)
		)

		return {
			success: true,
			data: catalogItems,
		}
	} catch (error) {
		console.error("Error fetching active tours:", error)
		return {
			success: false,
			error: "Error al obtener tours activos",
		}
	}
}

export async function getTransferServices() {
	try {
		const transferServices = await prisma.transferService.findMany({
			orderBy: [{ direction: "asc" }, { name: "asc" }],
		})

		return {
			success: true,
			data: transferServices as TransferServiceItem[],
		}
	} catch (error) {
		console.error("Error fetching transfer services:", error)
		return {
			success: false,
			error: "Error al obtener servicios de transfer",
		}
	}
}

export async function updateTransferServicePricing(data: {
	id: string
	pricePerPassenger: number
	receptionPricePerPassenger: number
	active?: boolean
}) {
	try {
		await requireTourInteraction()
		const transferService = await prisma.transferService.update({
			where: { id: data.id },
			data: {
				pricePerPassenger: data.pricePerPassenger,
				receptionPricePerPassenger: data.receptionPricePerPassenger,
				...(typeof data.active === "boolean" && { active: data.active }),
			},
		})

		revalidatePath("/dashboard")
		revalidatePath("/dashboard/tours")

		return {
			success: true,
			data: transferService,
		}
	} catch (error) {
		console.error("Error updating transfer pricing:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : "Error al actualizar precios de transfer",
		}
	}
}

export async function createTour(data: CreateTour) {
	try {
		await requireTourInteraction()
		const validatedData = createTourSchema.parse(data)
		const priceCategoriesData =
			validatedData.priceCategories && validatedData.priceCategories.length > 0
				? validatedData.priceCategories
				: DEFAULT_PRICE_CATEGORIES

		const tour = await prisma.tour.create({
			data: {
				name: validatedData.name,
				description: validatedData.description,
				recommendations: validatedData.recommendations,
				maxCapacity: validatedData.maxCapacity,
				priceCategories: {
					create: priceCategoriesData.map((pc, index) => ({
						name: pc.name,
						price: pc.price,
						transferPrice: pc.transferPrice ?? 0,
						receptionPrice: pc.receptionPrice ?? 0,
						minPrice: pc.minPrice ?? null,
						maxPrice: pc.maxPrice ?? null,
						ageMin: pc.ageMin ?? null,
						ageMax: pc.ageMax ?? null,
						isDefault: pc.isDefault ?? false,
						isSpecial: pc.isSpecial ?? false,
						sortOrder: pc.sortOrder ?? index,
						active: pc.active ?? true,
						entries: {
							create: (pc.entries || []).map((entry, eIndex) => ({
								name: entry.name,
								variantName: entry.variantName,
								price: entry.price,
								isDefault: entry.isDefault ?? false,
								isSpecial: entry.isSpecial ?? false,
								sortOrder: entry.sortOrder ?? eIndex,
								active: entry.active ?? true,
							})),
						},
					})),
				},
				privatePriceTiers:
					validatedData.privatePricing && validatedData.privatePricing.length > 0
						? {
								create: validatedData.privatePricing.map(
									(pricing: { capacity: number; price: number; entryPrice: number }) => ({
										capacity: pricing.capacity,
										price: pricing.price,
										entryPrice: pricing.entryPrice ?? 0,
									})
								),
							}
						: undefined,
				startTime: validatedData.startTime,
				endTime: validatedData.endTime,
				websiteUrl: validatedData.websiteUrl,
				imageUrl: validatedData.imageUrl,
				generalSummaryEs: validatedData.generalSummaryEs,
				generalSummaryEn: validatedData.generalSummaryEn,
				generalSummaryPt: validatedData.generalSummaryPt,
				scheduleEs: validatedData.scheduleEs,
				scheduleEn: validatedData.scheduleEn,
				schedulePt: validatedData.schedulePt,
				includesEs: validatedData.includesEs,
				includesEn: validatedData.includesEn,
				includesPt: validatedData.includesPt,
				pickupEs: validatedData.pickupEs,
				pickupEn: validatedData.pickupEn,
				pickupPt: validatedData.pickupPt,
				whatToBringEs: validatedData.whatToBringEs,
				whatToBringEn: validatedData.whatToBringEn,
				whatToBringPt: validatedData.whatToBringPt,
				altitudeEs: validatedData.altitudeEs,
				altitudeEn: validatedData.altitudeEn,
				altitudePt: validatedData.altitudePt,
				active: validatedData.active,
			},
		})

		revalidatePath("/dashboard")
		revalidatePath("/dashboard/tours")

		return {
			success: true,
			data: tour,
		}
	} catch (error) {
		console.error("Error creating tour:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : "Error al crear el tour",
		}
	}
}

export async function updateTour(data: UpdateTour) {
	try {
		await requireTourInteraction()
		const validatedData = updateTourSchema.parse(data)
		const { id } = validatedData

		const tour = await prisma.tour.update({
			where: { id },
			data: {
				name: validatedData.name,
				description: validatedData.description,
				recommendations: validatedData.recommendations,
				maxCapacity: validatedData.maxCapacity,
				startTime: validatedData.startTime,
				endTime: validatedData.endTime,
				websiteUrl: validatedData.websiteUrl,
				imageUrl: validatedData.imageUrl,
				generalSummaryEs: validatedData.generalSummaryEs,
				generalSummaryEn: validatedData.generalSummaryEn,
				generalSummaryPt: validatedData.generalSummaryPt,
				scheduleEs: validatedData.scheduleEs,
				scheduleEn: validatedData.scheduleEn,
				schedulePt: validatedData.schedulePt,
				includesEs: validatedData.includesEs,
				includesEn: validatedData.includesEn,
				includesPt: validatedData.includesPt,
				pickupEs: validatedData.pickupEs,
				pickupEn: validatedData.pickupEn,
				pickupPt: validatedData.pickupPt,
				whatToBringEs: validatedData.whatToBringEs,
				whatToBringEn: validatedData.whatToBringEn,
				whatToBringPt: validatedData.whatToBringPt,
				altitudeEs: validatedData.altitudeEs,
				altitudeEn: validatedData.altitudeEn,
				altitudePt: validatedData.altitudePt,
				active: validatedData.active,
				privatePriceTiers: {
					deleteMany: {},
					create:
						validatedData.privatePricing?.map(
							(pricing: { capacity: number; price: number; entryPrice: number }) => ({
								capacity: pricing.capacity,
								price: pricing.price,
								entryPrice: pricing.entryPrice ?? 0,
							})
						) || [],
				},
				priceCategories: {
					deleteMany: {},
					create:
						validatedData.priceCategories?.map((pc, index) => ({
							name: pc.name,
							price: pc.price,
							transferPrice: pc.transferPrice ?? 0,
							receptionPrice: pc.receptionPrice ?? 0,
							minPrice: pc.minPrice ?? null,
							maxPrice: pc.maxPrice ?? null,
							ageMin: pc.ageMin ?? null,
							ageMax: pc.ageMax ?? null,
							isDefault: pc.isDefault ?? false,
							isSpecial: pc.isSpecial ?? false,
							sortOrder: pc.sortOrder ?? index,
							active: pc.active ?? true,
							entries: {
								create: (pc.entries || []).map((entry, eIndex) => ({
									name: entry.name,
									variantName: entry.variantName,
									price: entry.price,
									isDefault: entry.isDefault ?? false,
									isSpecial: entry.isSpecial ?? false,
									sortOrder: entry.sortOrder ?? eIndex,
									active: entry.active ?? true,
								})),
							},
						})) || [],
				},
			},
		})

		revalidatePath("/dashboard")
		revalidatePath("/dashboard/tours")

		return {
			success: true,
			data: tour,
		}
	} catch (error) {
		console.error("Error updating tour:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : "Error al actualizar el tour",
		}
	}
}

export async function deleteTour(id: string) {
	try {
		await requireTourInteraction()
		await prisma.tour.delete({
			where: { id },
		})

		revalidatePath("/dashboard")
		revalidatePath("/dashboard/tours")

		return {
			success: true,
		}
	} catch (error) {
		console.error("Error deleting tour:", error)
		return {
			success: false,
			error: "Error al eliminar el tour",
		}
	}
}

export async function toggleTourStatus(id: string, active: boolean) {
	try {
		await requireTourInteraction()
		const tour = await prisma.tour.update({
			where: { id },
			data: { active },
		})

		revalidatePath("/dashboard")
		revalidatePath("/dashboard/tours")

		return {
			success: true,
			data: tour,
		}
	} catch (error) {
		console.error("Error toggling tour status:", error)
		return {
			success: false,
			error: "Error al cambiar el estado del tour",
		}
	}
}

export async function getToursSummary() {
	try {
		await getAuthUser()
		const [totalTours, activeTours, totalTransfers] = await Promise.all([
			prisma.tour.count(),
			prisma.tour.count({ where: { active: true } }),
			prisma.transferService.count(),
		])
		const totalRegularTours = totalTours

		const summary: TourSummary = {
			totalTours,
			activeTours,
			totalTransfers,
			totalRegularTours,
		}

		return {
			success: true,
			data: summary,
		}
	} catch (error) {
		console.error("Error fetching tours summary:", error)
		return {
			success: false,
			error: "Error al obtener el resumen de tours",
		}
	}
}
