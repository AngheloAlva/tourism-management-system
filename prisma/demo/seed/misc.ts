/**
 * Seed: miscellaneous lighter domains (≥5 records each).
 *
 * Covers:
 *   - ApprovalRequest (approvals domain)
 *   - AgencyTransfer (transfers domain)
 *   - AuditLog (audit domain)
 *
 * Must run after users, agencies, transferAgencies, and sales.
 */

import { faker } from "@faker-js/faker"
// Direct relative path — @generated/* alias is resolved by Next/tsc but not by tsx at runtime.
import type { PrismaClient } from "../../../../src/generated/prisma/client"
import type { SaleContext } from "./sales"

faker.seed(50)

const APPROVAL_ACTIONS = [
  "CANCEL_EVENT",
  "CANCEL_BOOKING",
  "CANCEL_SALE_RECORD",
  "DELETE_AGENCY",
  "BAN_USER",
] as const

const APPROVAL_STATUSES = [
  "PENDING",
  "APPROVED",
  "EXECUTED",
  "REJECTED",
  "EXPIRED",
] as const

interface MiscInput {
  adminUserId: string
  sellerUserIds: string[]
  agencyIds: string[]
  transferAgencyIds: string[]
  sales: SaleContext[]
  eventIds: string[]
}

export async function seedMisc(
  prisma: PrismaClient,
  input: MiscInput,
): Promise<void> {
  console.log("  Seeding miscellaneous domains...")

  const { adminUserId, sellerUserIds, agencyIds, transferAgencyIds, sales, eventIds } = input
  const allUserIds = [adminUserId, ...sellerUserIds]

  // --- ApprovalRequests (≥5) ---
  const approvalCount = 6
  for (let i = 0; i < approvalCount; i++) {
    const action = APPROVAL_ACTIONS[i % APPROVAL_ACTIONS.length]
    const status = APPROVAL_STATUSES[i % APPROVAL_STATUSES.length]
    await prisma.approvalRequest.create({
      data: {
        action,
        status,
        domain: action.toLowerCase().split("_")[1] ?? "general",
        targetType: "SaleRecord",
        targetId: sales[i % sales.length]?.saleId ?? "unknown",
        reason: `Demo: solicitud de ${action.toLowerCase().replace(/_/g, " ")}`,
        requestedById: allUserIds[i % allUserIds.length],
        verifiedById: status === "APPROVED" || status === "EXECUTED" ? adminUserId : null,
        resolvedById: status === "EXECUTED" || status === "REJECTED" ? adminUserId : null,
        resolvedAt: status === "EXECUTED" || status === "REJECTED" ? new Date() : null,
      },
    })
  }

  // --- AgencyTransfers (≥5) ---
  const transferCount = 6
  for (let i = 0; i < transferCount; i++) {
    const transferDate = new Date("2026-06-23")
    transferDate.setDate(transferDate.getDate() - i * 3)
    const voucher = 3000 + i
    const agencyId = transferAgencyIds[i % transferAgencyIds.length]
    const sellerId = sellerUserIds[i % sellerUserIds.length]

    const transfer = await prisma.agencyTransfer.create({
      data: {
        voucher,
        type: i % 2 === 0 ? "OUTGOING" : "INCOMING",
        date: transferDate,
        paymentStatus: "FULLY_PAID",
        status: "ACTIVE",
        agencyId,
        createdBy: sellerId,
        comments: `Traslado demo #${i + 1}`,
        makePayment: false,
      },
    })

    // Add a passenger to the transfer
    await prisma.passenger.create({
      data: {
        transferId: transfer.id,
        name: faker.person.fullName(),
        age: faker.number.int({ min: 18, max: 70 }),
        nationality: "Chilena",
        diet: "NORMAL",
        phone: `+569${faker.string.numeric(8)}`,
      },
    })

    // Payment record for transfer
    await prisma.paymentRecord.create({
      data: {
        transferId: transfer.id,
        refund: false,
        method: "TRANSFER",
        amount: faker.number.int({ min: 30000, max: 100000 }),
        currency: "CLP",
        date: transferDate,
        documentNumber: `TR-${faker.string.numeric(6)}`,
        isTransferPayment: true,
      },
    })

    // Link to an event if available
    if (eventIds.length > 0) {
      const eventId = eventIds[i % eventIds.length]
      const teb = await prisma.transferEventBooking.create({
        data: {
          eventId,
          transferId: transfer.id,
          passengerCount: 2,
          adultsCount: 2,
          childrenCount: 0,
          seniorsCount: 0,
        },
      })

      // Transfer price detail
      await prisma.transferPriceDetail.create({
        data: {
          transferId: transfer.id,
          eventBookingId: teb.id,
          passengerName: "Demo Pasajero",
          ageCategory: "Adulto",
          tourPrice: 50000,
          entrancePrice: 5000,
          totalPrice: 55000,
        },
      })
    }
  }

  // --- AuditLogs (≥5) ---
  const auditCount = 8
  for (let i = 0; i < auditCount; i++) {
    await prisma.auditLog.create({
      data: {
        action: faker.helpers.arrayElement(["CREATE", "UPDATE", "DELETE"] as const),
        entityType: faker.helpers.arrayElement(["SaleRecord", "Event", "CashBoxEntry"]),
        entityId: sales[i % sales.length]?.saleId ?? "demo",
        userId: allUserIds[i % allUserIds.length],
        userName: "Demo User",
        userEmail: "demo@atacama-demo.cl",
        description: `Demo audit entry ${i + 1}`,
        changes: { field: "status", from: "PENDING", to: "COMPLETED" },
      },
    })
  }

  console.log(`    Created ${approvalCount} approvals, ${transferCount} transfers, ${auditCount} audit logs.`)
}
