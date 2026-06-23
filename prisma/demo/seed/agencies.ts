/**
 * Seed: agencies + transfer agencies.
 *
 * Both entity types need to exist before sales and transfers reference them.
 */

import { faker } from "@faker-js/faker"
// Direct relative path — @generated/* alias is resolved by Next/tsc but not by tsx at runtime.
import type { PrismaClient } from "../../../../src/generated/prisma/client"
import { AGENCY_NAMES, TRANSFER_AGENCY_NAMES } from "./constants"

faker.seed(42)

const CHILEAN_CITIES = [
  "Santiago",
  "Calama",
  "Antofagasta",
  "La Serena",
  "Valparaíso",
]

export interface SeededAgencies {
  agencyIds: string[]
  transferAgencyIds: string[]
}

export async function seedAgencies(prisma: PrismaClient): Promise<SeededAgencies> {
  console.log("  Seeding agencies and transfer agencies...")

  const agencyIds: string[] = []
  const transferAgencyIds: string[] = []

  for (const name of AGENCY_NAMES) {
    const city = faker.helpers.arrayElement(CHILEAN_CITIES)
    const agency = await prisma.agency.create({
      data: {
        name,
        contactEmails: [`contacto@${name.toLowerCase().replace(/\s+/g, "")}.cl`],
        phone: `+569${faker.string.numeric(8)}`,
        country: "Chile",
        address: `${faker.location.streetAddress()}, ${city}`,
        website: `https://www.${name.toLowerCase().replace(/\s+/g, "")}.cl`,
        taxId: `${faker.string.numeric(2)}.${faker.string.numeric(3)}.${faker.string.numeric(3)}-${faker.string.numeric(1)}`,
        codePrefix: name.substring(0, 2).toUpperCase(),
        codeLength: 8,
        active: true,
      },
    })
    agencyIds.push(agency.id)
  }

  for (const name of TRANSFER_AGENCY_NAMES) {
    const city = faker.helpers.arrayElement(CHILEAN_CITIES)
    const ta = await prisma.transferAgency.create({
      data: {
        name,
        contactEmails: [`ops@${name.toLowerCase().replace(/\s+/g, "")}.cl`],
        phone: `+569${faker.string.numeric(8)}`,
        country: "Chile",
        address: `${faker.location.streetAddress()}, ${city}`,
        active: true,
      },
    })
    transferAgencyIds.push(ta.id)
  }

  console.log(`    Created ${agencyIds.length} agencies and ${transferAgencyIds.length} transfer agencies.`)
  return { agencyIds, transferAgencyIds }
}
