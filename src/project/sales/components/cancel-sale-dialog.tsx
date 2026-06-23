"use client"

import { authClient } from "@/lib/auth-client"
import { APPROVAL_ACTION } from "@/generated/prisma/enums"
import { RequestApprovalDialog } from "@/project/approvals/components/request/request-approval-dialog"
import type { SaleRecordWithDetails } from "../actions/sale-record.actions"

interface CancelSaleDialogProps {
	sale: SaleRecordWithDetails | null
	open: boolean
	onOpenChange: (open: boolean) => void
	onSuccess?: () => void
}

export function CancelSaleDialog({ sale, open, onOpenChange, onSuccess }: CancelSaleDialogProps) {
	const { data: session } = authClient.useSession()
	const isAdmin = session?.user?.role === "admin"

	if (!sale) return null

	const targetLabel = `${sale.type === "SALE" ? "Venta" : "Cotización"} #${sale.voucher}`

	return (
		<RequestApprovalDialog
			open={open}
			onOpenChange={onOpenChange}
			action={APPROVAL_ACTION.CANCEL_SALE_RECORD}
			targetType="sale-record"
			targetId={sale.id}
			targetLabel={targetLabel}
			payload={{ reason: "" }}
			snapshot={{
				id: sale.id,
				status: sale.status,
				voucher: sale.voucher,
				type: sale.type,
			}}
			isAdmin={isAdmin}
			onSuccess={() => {
				onOpenChange(false)
				onSuccess?.()
			}}
		/>
	)
}
