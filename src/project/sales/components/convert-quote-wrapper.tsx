"use client"

import { useRouter } from "next/navigation"
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

interface ConvertQuoteWrapperProps {
	quote: SaleRecordWithDetails
}

export function ConvertQuoteWrapper({ quote }: ConvertQuoteWrapperProps) {
	const { setEditMode, resetForm, setAgencyName, setWholesaleAgencyName } = useSaleFormStore()
	const router = useRouter()

	// Verificar que sea una cotización y no haya sido convertida ya
	useEffect(() => {
		if (quote.type !== "QUOTE") {
			router.push("/dashboard/navegacion-cotizaciones")
			return
		}

		if (quote.convertedToSale) {
			router.push("/dashboard/navegacion-cotizaciones")
			return
		}
	}, [quote, router])

	const initialData = useMemo<SaleRecordFormSchema | undefined>(() => {
		if (!quote) return undefined

		return {
			// Cambiar tipo a SALE para la conversión
			type: "SALE",
			channel: quote.channel,
			discount: quote.discount,
			comments: quote.comments || "",
			agencyId: quote.agency?.id || "",
			fileNumber: quote.fileNumber || "",
			fileNumberPending: deriveFileNumberPending(quote),
			isWholesale: quote.isWholesale,
			wholesaleAgencyId: quote.wholesaleAgency?.id || "",
			wholesaleMarkup: quote.wholesaleMarkup,
			paymentPending: derivePaymentPending(quote),
			// Campo para rastrear la conversión
			convertedFromQuoteId: quote.id,
			eventBookings: mapEventBookingsToForm(quote.eventBookings, quote.passengers),
			passengerArray: mapPassengersToForm(quote.passengers),
			// Pagos vacíos para que el usuario agregue los pagos de la venta
			paymentArray: [
				{
					clientId: createClientId(),
					refund: false,
					method: "CASH",
					currency: "CLP",
					exchange_rate: undefined,
					amount: 0,
					movement_date: new Date(),
					document_number: "",
					comments: "",
				},
			],
		}
	}, [quote])

	useEffect(() => {
		if (quote && initialData) {
			// No usamos editMode ya que estamos creando un nuevo registro
			setEditMode(false)
			setAgencyName(quote.agency?.name || "")
			setWholesaleAgencyName(quote.wholesaleAgency?.name || "")
		}

		return () => {
			resetForm()
		}
	}, [quote, initialData, setEditMode, resetForm, setAgencyName, setWholesaleAgencyName])

	if (!quote) return null

	return <SalesQuoteForm initialData={initialData} />
}
