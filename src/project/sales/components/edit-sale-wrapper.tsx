"use client"

import { useEffect, useMemo } from "react"

import { useSaleFormStore } from "../stores/sale-form.store"

import SalesQuoteForm from "./sale-quote-form/sales-quote-form"

import {
	deriveFileNumberPending,
	derivePaymentPending,
	mapEventBookingsToForm,
	mapPassengersToForm,
} from "../utils/sale-form-mappers"
import type { SaleRecordWithDetails } from "../actions/sale-record.actions"
import type { SaleRecordFormSchema } from "../schemas/sale-record.schema"
import { createClientId } from "@/shared/lib/create-client-id"

interface EditSaleWrapperProps {
	sale: SaleRecordWithDetails
}

export function EditSaleWrapper({ sale }: EditSaleWrapperProps) {
	const { setEditMode, resetForm, setAgencyName, setWholesaleAgencyName } = useSaleFormStore()

	const initialData = useMemo<SaleRecordFormSchema | undefined>(() => {
		if (!sale) return undefined

		return {
			type: sale.type,
			channel: sale.channel,
			discount: sale.discount,
			comments: sale.comments || "",
			agencyId: sale.agency?.id || "",
			fileNumber: sale.fileNumber || "",
			fileNumberPending: deriveFileNumberPending(sale),
			isWholesale: sale.isWholesale,
			wholesaleAgencyId: sale.wholesaleAgency?.id || "",
			wholesaleMarkup: sale.wholesaleMarkup,
			paymentPending: derivePaymentPending(sale),
			eventBookings: mapEventBookingsToForm(sale.eventBookings, sale.passengers),
			passengerArray: mapPassengersToForm(sale.passengers),
			paymentArray: sale.paymentRecords.map((payment) => ({
				clientId: payment.id || createClientId(),
				refund: payment.refund,
				method: payment.method,
				currency: payment.currency,
				amount:
					payment.currency === "USD" ? (payment.originalAmount ?? payment.amount) : payment.amount,
				exchange_rate: payment.exchangeRate || undefined,
				date: new Date(payment.date),
				documentNumber: payment.documentNumber || "",
				comments: payment.comments || "",
				document_number: payment.documentNumber || "",
				movement_date: new Date(payment.date),
				paymentProof: "",
			})),
		}
	}, [sale])

	useEffect(() => {
		if (sale && initialData) {
			setEditMode(true, sale.id, sale.voucher)
			setAgencyName(sale.agency?.name || "")
			setWholesaleAgencyName(sale.wholesaleAgency?.name || "")
		}

		return () => {
			resetForm()
		}
	}, [sale, initialData, setEditMode, resetForm, setAgencyName, setWholesaleAgencyName])

	if (!sale) return null

	return <SalesQuoteForm initialData={initialData} />
}
