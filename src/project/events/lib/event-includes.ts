import type { Prisma } from "@/generated/prisma/client"

export const eventServiceMinimalInclude = {
  tour: { select: { id: true, name: true } },
  transferService: { select: { id: true, name: true } },
} satisfies Prisma.EventInclude

export const eventServiceWithScheduleInclude = {
  tour: { select: { id: true, name: true, startTime: true, endTime: true } },
  transferService: { select: { id: true, name: true } },
} satisfies Prisma.EventInclude
