/**
 * Seed: providers (guides, drivers, vehicles, catering).
 *
 * Creates a set of providers with different service flags.
 * Must run before calendar (events reference providers).
 */

import { faker } from "@faker-js/faker"
// Direct relative path — @generated/* alias is resolved by Next/tsc but not by tsx at runtime.
import type { PrismaClient } from "../../../../src/generated/prisma/client"

faker.seed(43)

const GUIDE_NAMES = [
  "Armando Pizarro",
  "Lorena Castillo",
  "Felipe Tapia",
  "Marcela Vidal",
  "Rodrigo Núñez",
]

const DRIVER_NAMES = [
  "Hugo Contreras",
  "Sandra Pérez",
  "Manuel Rojas",
]

const VEHICLE_BRANDS = ["Toyota", "Mitsubishi", "Ford", "Chevrolet"]
const VEHICLE_MODELS = ["Land Cruiser", "L200", "Ranger", "Silverado"]

const CATERING_NAMES = [
  "Cocina Andina SpA",
  "Delicias del Desierto",
  "Alto Norte Catering",
]

export interface SeededProviders {
  guideIds: string[]
  driverIds: string[]
  vehicleIds: string[]
  cateringIds: string[]
}

function randomRut(seed: number): string {
  const base = (10_000_000 + seed * 137_241) % 25_000_000
  const digits = base.toString()
  const dv = (seed % 9) === 0 ? "K" : String(seed % 9)
  return `${digits.substring(0, 2)}.${digits.substring(2, 5)}.${digits.substring(5, 8)}-${dv}`
}

export async function seedProviders(prisma: PrismaClient): Promise<SeededProviders> {
  console.log("  Seeding providers...")

  const guideIds: string[] = []
  const driverIds: string[] = []
  const vehicleIds: string[] = []
  const cateringIds: string[] = []

  // Guides
  for (let i = 0; i < GUIDE_NAMES.length; i++) {
    const p = await prisma.provider.create({
      data: {
        type: "NATURAL",
        rut: randomRut(i + 10),
        fullName: GUIDE_NAMES[i],
        isActive: true,
        guia: true,
        email: `guia${i + 1}@atacama-demo.cl`,
        phone: `+569${faker.string.numeric(8)}`,
        guideCost: faker.number.int({ min: 30000, max: 80000 }),
      },
    })
    guideIds.push(p.id)
  }

  // Drivers
  for (let i = 0; i < DRIVER_NAMES.length; i++) {
    const p = await prisma.provider.create({
      data: {
        type: "NATURAL",
        rut: randomRut(i + 20),
        fullName: DRIVER_NAMES[i],
        isActive: true,
        conductor: true,
        licenseType: "Clase A3",
        email: `driver${i + 1}@atacama-demo.cl`,
        phone: `+569${faker.string.numeric(8)}`,
        driverCost: faker.number.int({ min: 40000, max: 100000 }),
      },
    })
    driverIds.push(p.id)
  }

  // Vehicles (máquinas)
  for (let i = 0; i < 4; i++) {
    const brand = VEHICLE_BRANDS[i % VEHICLE_BRANDS.length]
    const model = VEHICLE_MODELS[i % VEHICLE_MODELS.length]
    const p = await prisma.provider.create({
      data: {
        type: "NATURAL",
        rut: randomRut(i + 30),
        fullName: `${brand} ${model} (${2018 + i})`,
        isActive: true,
        maquina: true,
        vehicleBrand: brand,
        vehicleModel: model,
        vehicleYear: 2018 + i,
        vehiclePlate: `ABCD${10 + i}`,
        vehicleCapacity: 12,
        vehicleCost: faker.number.int({ min: 50000, max: 120000 }),
      },
    })
    vehicleIds.push(p.id)
  }

  // Catering providers
  const cateringOptions = await prisma.cateringOption.findMany()
  for (let i = 0; i < CATERING_NAMES.length; i++) {
    const p = await prisma.provider.create({
      data: {
        type: "JURIDICA",
        rut: randomRut(i + 40),
        companyName: CATERING_NAMES[i],
        isActive: true,
        cocteleria: true,
        email: `catering${i + 1}@atacama-demo.cl`,
        phone: `+569${faker.string.numeric(8)}`,
        otherCost: faker.number.int({ min: 5000, max: 15000 }),
      },
    })
    cateringIds.push(p.id)

    // Link catering options if they exist
    for (const opt of cateringOptions.slice(0, 2)) {
      await prisma.providerCatering.create({
        data: {
          providerId: p.id,
          cateringOptionId: opt.id,
          pricePerPerson: faker.number.int({ min: 5000, max: 15000 }),
        },
      })
    }
  }

  console.log(`    Created ${guideIds.length} guides, ${driverIds.length} drivers, ${vehicleIds.length} vehicles, ${cateringIds.length} catering providers.`)
  return { guideIds, driverIds, vehicleIds, cateringIds }
}
