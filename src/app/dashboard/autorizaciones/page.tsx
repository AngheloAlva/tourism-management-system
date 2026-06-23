import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { ShieldCheckIcon } from "lucide-react"

import { auth } from "@/lib/auth"
import { getRequestCounts } from "@/project/approvals/server/queries"
import { ApprovalInboxTable } from "@/project/approvals/components/inbox/approval-inbox-table"

export const metadata = {
  title: "Autorizaciones — TurismoChileTours",
  description: "Bandeja de solicitudes de autorización para acciones destructivas",
}

export default async function AutorizacionesPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user || session.user.role !== "admin") {
    notFound()
  }

  const counts = await getRequestCounts()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheckIcon className="h-6 w-6" />
        <div>
          <h1 className="text-xl font-semibold">Autorizaciones</h1>
          <p className="text-muted-foreground text-sm">
            Revisá y resolvé las solicitudes de autorización para acciones que requieren aprobación.
          </p>
        </div>
      </div>

      <ApprovalInboxTable
        initialPendingCount={counts.pending}
        initialResolvedCount={counts.resolved}
      />
    </div>
  )
}
