import { NextRequest, NextResponse } from "next/server"
import { completeElapsedEvents } from "@/project/events/actions/event-completion.actions"

export const dynamic = "force-dynamic"

/**
 * Cron handler para marcar como COMPLETED los eventos cuya fecha de ejecución
 * tiene 7 o más días de antigüedad (regla de los 7 días).
 * Se ejecuta diariamente a las 05:00 UTC (configurado en vercel.json).
 *
 * CRON_SECRET debe configurarse en Vercel Project Settings → Environment Variables.
 * Vercel inyecta: Authorization: Bearer <CRON_SECRET> en cada invocación del cron.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")

  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const result = await completeElapsedEvents()

  return NextResponse.json(result)
}
