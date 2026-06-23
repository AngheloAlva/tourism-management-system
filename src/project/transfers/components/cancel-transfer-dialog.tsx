"use client"

import { authClient } from "@/lib/auth-client"
import { APPROVAL_ACTION } from "@/generated/prisma/enums"
import { RequestApprovalDialog } from "@/project/approvals/components/request/request-approval-dialog"

interface CancelTransferDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	transferId: string
	transferVoucher: number
	transferType: "OUTGOING" | "INCOMING"
	onSuccess?: () => void
}

/**
 * Dialog para solicitar cancelación de un traspaso o recepción.
 * Reemplaza el flujo de confirmación directa por el flujo asincrónico de autorizaciones.
 */
export function CancelTransferDialog({
	open,
	onOpenChange,
	transferId,
	transferVoucher,
	transferType,
	onSuccess,
}: CancelTransferDialogProps) {
	const { data: session } = authClient.useSession()
	const isAdmin = session?.user?.role === "admin"

	const action =
		transferType === "OUTGOING"
			? APPROVAL_ACTION.CANCEL_TRANSFER
			: APPROVAL_ACTION.CANCEL_RECEPTION

	const label =
		transferType === "OUTGOING"
			? `Traspaso #T-${transferVoucher}`
			: `Recepción #T-${transferVoucher}`

	return (
		<RequestApprovalDialog
			open={open}
			onOpenChange={onOpenChange}
			action={action}
			targetType="agency-transfer"
			targetId={transferId}
			targetLabel={label}
			payload={{ type: transferType, voucher: transferVoucher }}
			isAdmin={isAdmin}
			onSuccess={() => {
				onOpenChange(false)
				onSuccess?.()
			}}
		/>
	)
}
