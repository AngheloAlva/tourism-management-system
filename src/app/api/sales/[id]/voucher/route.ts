import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { renderToStream } from "@react-pdf/renderer"
import React from "react"

import { auth } from "@/lib/auth"
import { canCurrentUserAccessPath } from "@/project/roles/actions/role.actions"
import { getSaleRecordById } from "@/project/sales/actions/sale-record.actions"

import { VoucherPDF } from "@/project/sales/components/voucher-pdf"

import type { Language } from "@/project/sales/utils/voucher-translations"
import {
	VOUCHER_PASSENGER_FILTERS,
	type VoucherPassengerFilter,
} from "@/project/sales/utils/voucher-passengers"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await auth.api.getSession({ headers: await headers() })
		if (!session?.user) {
			return NextResponse.json({ message: "No autorizado" }, { status: 401 })
		}

		const canAccess = await canCurrentUserAccessPath("/navegacion-ventas")
		if (!canAccess) {
			return NextResponse.json({ message: "No tiene permisos" }, { status: 403 })
		}

		const sale = await getSaleRecordById((await params).id)

		if (!sale) {
			return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
		}

		// Get language and includePrice from query params
		const { searchParams } = new URL(request.url)
		const language = (searchParams.get("lang") || "es") as Language
		const includePrice = searchParams.get("includePrice") !== "false"
		const passengersParam = searchParams.get("passengers")
		const passengerFilter: VoucherPassengerFilter =
			passengersParam && VOUCHER_PASSENGER_FILTERS.includes(passengersParam as VoucherPassengerFilter)
				? (passengersParam as VoucherPassengerFilter)
				: "all"

		const stream = await renderToStream(
			React.createElement(VoucherPDF, { sale, language, includePrice, passengerFilter })
		)

		const chunks: Buffer[] = []
		for await (const chunk of stream) {
			chunks.push(Buffer.from(chunk))
		}
		const buffer = Buffer.concat(chunks)

		const languageSuffix = language !== "es" ? `-${language}` : ""

		return new NextResponse(buffer, {
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="voucher-${sale.voucher}${languageSuffix}.pdf"`,
			},
		})
	} catch (error) {
		console.error("Error generando voucher:", error)
		return NextResponse.json({ error: "Error al generar el voucher" }, { status: 500 })
	}
}
