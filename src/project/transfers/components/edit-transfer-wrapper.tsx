"use client"

import { useMemo } from "react"
import { notFound } from "next/navigation"

import { useTransfer } from "../hooks/use-transfers"
import { TransferForm } from "./transfer-form"
import { createClientId } from "@/shared/lib/create-client-id"
import { ModuleLoadingSkeleton } from "@/shared/components/ui/module-loading-skeleton"

import type { TransferFormData } from "../schemas/transfer.schema"

interface EditTransferWrapperProps {
	id: string
}

export function EditTransferWrapper({ id }: EditTransferWrapperProps) {
	const { data: transfer, isLoading } = useTransfer(id)

	const initialData = useMemo<TransferFormData | undefined>(() => {
		if (!transfer) return undefined

		const eventTransfers = transfer.eventBookings.map((booking) => {
			const passengerPrices = transfer.priceDetails.map((detail) => ({
				clientId: createClientId(),
				passengerId: detail.sourcePassengerId || detail.id,
				sourceSaleRecordId: transfer.saleRecord?.id || "",
				sourceVoucher: transfer.saleRecord?.voucher,
				isSelected: true,
				isAlreadyTransferred: false,
				passengerName: detail.passengerName,
				ageCategory: detail.ageCategory,
				tourPrice: detail.tourPrice,
				entrancePrice: detail.entrancePrice,
				totalPrice: detail.totalPrice,
			}))

			return {
				clientId: createClientId(),
				eventId: booking.event.id,
				transferEvent: true,
				passengerPrices,
			}
		})

		const payments = transfer.payments.map((payment) => ({
			clientId: createClientId(),
			refund: payment.refund,
			method: payment.method,
			amount: String(payment.amount),
			date: new Date(payment.date),
			documentNumber: payment.documentNumber || "",
			comments: payment.comments || "",
		}))

		return {
			type: transfer.type,
			agencyId: transfer.agency.id,
			date: new Date(transfer.date),
			paymentStatus: transfer.paymentStatus,
			comments: transfer.comments || "",
			saleRecordId: transfer.saleRecord?.id || "",
			eventTransfers,
			payments,
		}
	}, [transfer])

	if (isLoading) {
		return <ModuleLoadingSkeleton />
	}

	if (!transfer || transfer.status === "CANCELLED") {
		notFound()
	}

	return <TransferForm initialData={initialData} mode="edit" transferId={id} />
}
