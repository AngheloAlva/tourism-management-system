import { NextRequest, NextResponse } from "next/server"
import { expirePendingApprovals } from "@/project/approvals/actions/approval.actions"

export const dynamic = "force-dynamic"

/**
 * Cron handler para expirar solicitudes PENDING con más de 7 días de antigüedad.
 * Se ejecuta diariamente a las 03:00 UTC (configurado en vercel.json).
 *
 * CRON_SECRET debe configurarse en Vercel Project Settings → Environment Variables.
 * Vercel inyecta: Authorization: Bearer <CRON_SECRET> en cada invocación del cron.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")

  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const result = await expirePendingApprovals()

  return NextResponse.json(result)
}
