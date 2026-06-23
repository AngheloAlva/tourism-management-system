/**
 * Seed: roles + role module permissions.
 *
 * Creates the standard role set used across the dashboard.
 * Must run FIRST — users reference roles by key.
 */

// Direct relative path — @generated/* alias is resolved by Next/tsc but not by tsx at runtime.
import type { PrismaClient } from "../../../../src/generated/prisma/client"

const MODULES = [
  "sales",
  "calendar",
  "cash-flow",
  "analytics",
  "agencies",
  "providers",
  "transfers",
  "receptions",
  "approvals",
  "billing",
  "users",
  "roles",
  "alerts",
  "commissions",
]

const ROLE_DEFINITIONS = [
  {
    key: "admin",
    name: "Administrador",
    description: "Acceso completo al sistema",
    isSystem: true,
    fullAccess: true,
  },
  {
    key: "seller",
    name: "Vendedor",
    description: "Acceso a ventas y calendario",
    isSystem: false,
    fullAccess: false,
    visibleModules: ["sales", "calendar", "receptions"],
  },
  {
    key: "cashier",
    name: "Cajero",
    description: "Acceso a flujo de caja",
    isSystem: false,
    fullAccess: false,
    visibleModules: ["cash-flow", "sales"],
  },
  {
    key: "manager",
    name: "Gerente",
    description: "Acceso a reportes y aprobaciones",
    isSystem: false,
    fullAccess: false,
    visibleModules: ["analytics", "approvals", "billing", "commissions"],
  },
]

export async function seedRoles(prisma: PrismaClient): Promise<string[]> {
  console.log("  Seeding roles...")

  const roleIds: string[] = []

  for (const def of ROLE_DEFINITIONS) {
    const role = await prisma.role.create({
      data: {
        key: def.key,
        name: def.name,
        description: def.description,
        isSystem: def.isSystem,
        isActive: true,
        permissions: {
          create: MODULES.map((moduleKey) => ({
            moduleKey,
            visible: def.fullAccess || (def.visibleModules?.includes(moduleKey) ?? false),
            canInteract:
              def.fullAccess || (def.visibleModules?.includes(moduleKey) ?? false),
          })),
        },
      },
    })
    roleIds.push(role.id)
  }

  // Seed the voucher counter
  await prisma.voucherCounter.upsert({
    where: { id: "counter" },
    update: {},
    create: { id: "counter", code: 2000 },
  })

  // Seed the agency transfer counter
  await prisma.agencyTransferCounter.upsert({
    where: { id: "agency_transfer_counter" },
    update: {},
    create: { id: "agency_transfer_counter", code: 500 },
  })

  console.log(`    Created ${ROLE_DEFINITIONS.length} roles.`)
  return roleIds
}
