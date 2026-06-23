/**
 * Seed: tours + price categories + private pricing tiers.
 *
 * Creates ≥10 tours, each with a "General" price category and 2 private tiers.
 * Must run before calendar (events reference tours) and sales (bookings reference
 * tour price categories).
 */

import { faker } from "@faker-js/faker"
// Direct relative path — @generated/* alias is resolved by Next/tsc but not by tsx at runtime.
import type { PrismaClient } from "../../../src/generated/prisma/client"
import { TOUR_NAMES } from "./constants"

faker.seed(44)

const TOUR_DESCRIPTIONS: Record<string, string> = {
  "Valle de la Luna": "Paisaje lunar al atardecer en el corazón del Atacama.",
  "Lagunas Altiplánicas": "Flamingos y lagunas de altura a 4.500 msnm.",
  "Géiseres del Tatio": "El campo de géiseres más alto del mundo al amanecer.",
  "Salar de Atacama": "Extensión infinita de sal y reflejos de cielo.",
  "Piedras Rojas": "Formaciones volcánicas de colores únicos en la puna.",
  "Laguna Cejar": "Flotación en aguas hipersalinas del desierto.",
  "Cañon del Diablo": "Travesía por cañones de arenisca milenaria.",
  "Quebrada de Jerez": "Valle de formaciones arcillosas multicolores.",
  "Laguna Miscanti": "Laguna altiplánica con volcanes de fondo.",
  "Aldea de Tulor": "Ruinas de 3.000 años del pueblo Atacameño.",
  "Pukará de Quitor": "Fortaleza prehispánica con vista a San Pedro.",
  "Termas de Puritama": "Aguas termales naturales en quebrada andina.",
}

export interface SeededTours {
  tourIds: string[]
  /** Map: tourId → default TourPriceCategory id */
  defaultCategoryByTour: Map<string, string>
}

export async function seedTours(prisma: PrismaClient): Promise<SeededTours> {
  console.log("  Seeding tours...")

  const tourIds: string[] = []
  const defaultCategoryByTour = new Map<string, string>()

  // Seed catering options first (needed by providers seed; idempotent here)
  const cateringOptionNames = ["Desayuno", "Almuerzo", "Coctel", "BoxLunch"]
  for (const name of cateringOptionNames) {
    await prisma.cateringOption.upsert({
      where: { name },
      update: {},
      create: { name, active: true },
    })
  }

  for (let i = 0; i < TOUR_NAMES.length; i++) {
    const name = TOUR_NAMES[i]
    const basePrice = 30000 + i * 5000

    const tour = await prisma.tour.create({
      data: {
        name,
        description: TOUR_DESCRIPTIONS[name] ?? `Tour ${name} en el desierto de Atacama.`,
        startTime: "08:00",
        endTime: i % 2 === 0 ? "12:00" : "18:00",
        maxCapacity: 12,
        active: true,
        recommendations: "Llevar protector solar, agua y ropa de abrigo para la noche.",
      },
    })
    tourIds.push(tour.id)

    // Default price category (Adulto)
    const defaultCat = await prisma.tourPriceCategory.create({
      data: {
        tourId: tour.id,
        name: "Adulto",
        price: basePrice,
        receptionPrice: Math.round(basePrice * 0.1),
        isDefault: true,
        sortOrder: 0,
        active: true,
      },
    })
    defaultCategoryByTour.set(tour.id, defaultCat.id)

    // Niño category
    await prisma.tourPriceCategory.create({
      data: {
        tourId: tour.id,
        name: "Niño",
        price: Math.round(basePrice * 0.5),
        receptionPrice: Math.round(basePrice * 0.05),
        ageMin: 3,
        ageMax: 12,
        isDefault: false,
        sortOrder: 1,
        active: true,
      },
    })

    // Private pricing tiers (2 per tour)
    await prisma.tourPrivatePricingTier.create({
      data: {
        tourId: tour.id,
        capacity: 4,
        price: basePrice * 4 * 1.2,
        entryPrice: basePrice * 0.1 * 4,
      },
    })
    await prisma.tourPrivatePricingTier.create({
      data: {
        tourId: tour.id,
        capacity: 8,
        price: basePrice * 8 * 1.1,
        entryPrice: basePrice * 0.1 * 8,
      },
    })

    // Transfer service (one per tour: IN direction)
    await prisma.transferService.upsert({
      where: { name: `Traslado ${name}` },
      update: {},
      create: {
        name: `Traslado ${name}`,
        direction: "IN",
        pricePerPassenger: Math.round(basePrice * 0.15),
        receptionPricePerPassenger: Math.round(basePrice * 0.05),
        active: true,
      },
    })
  }

  console.log(`    Created ${tourIds.length} tours with price categories and private tiers.`)
  return { tourIds, defaultCategoryByTour }
}
