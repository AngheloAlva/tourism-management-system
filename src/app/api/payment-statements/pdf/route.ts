import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { renderToStream } from "@react-pdf/renderer"

import { auth } from "@/lib/auth"
import { canCurrentUserAccessPath } from "@/project/roles/actions/role.actions"
import { getPaymentStatementPdfData } from "@/project/payment-statements/actions/payment-statement.actions"
import { PaymentStatementPdf } from "@/project/payment-statements/components/payment-statement-pdf"

export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() })
		if (!session?.user) {
			return NextResponse.json({ message: "No autorizado" }, { status: 401 })
		}

		const canAccess = await canCurrentUserAccessPath("/facturacion")
		if (!canAccess) {
			return NextResponse.json({ message: "No tiene permisos" }, { status: 403 })
		}

		const { searchParams } = new URL(request.url)
		const agencyIdsParam = searchParams.get("agencyIds")
		const startDate = searchParams.get("startDate")
		const endDate = searchParams.get("endDate")

		const agencyIds = agencyIdsParam
			? agencyIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
			: []

		if (agencyIds.length === 0 || !startDate || !endDate) {
			return NextResponse.json(
				{ message: "Faltan parámetros: agencyIds, startDate, endDate" },
				{ status: 400 }
			)
		}

		const data = await getPaymentStatementPdfData({
			agencyIds,
			startDate: new Date(startDate),
			endDate: new Date(endDate),
		})

		if (data.sales.length === 0) {
			return NextResponse.json(
				{ message: "No hay ventas para generar el estado de pago" },
				{ status: 404 }
			)
		}

		const pdfDocument = PaymentStatementPdf({
			agencies: data.agencies,
			period: data.period,
			sales: data.sales,
			totals: data.totals,
			generatedAt: data.generatedAt,
		})

		const stream = await renderToStream(pdfDocument)

		const chunks: Buffer[] = []
		for await (const chunk of stream) {
			chunks.push(Buffer.from(chunk))
		}
		const buffer = Buffer.concat(chunks)

		const startDateLabel = startDate.slice(0, 10)
		const endDateLabel = endDate.slice(0, 10)
		const agencyLabel =
			data.agencies.length === 1
				? data.agencies[0].name.replace(/\s+/g, "-").toLowerCase()
				: "multiagencia"
		const filename = `estado-pago-${agencyLabel}-${startDateLabel}-${endDateLabel}.pdf`

		return new NextResponse(buffer, {
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="${filename}"`,
			},
		})
	} catch (error) {
		console.error("Error generando estado de pago:", error)
		return NextResponse.json(
			{ message: "Error al generar el PDF" },
			{ status: 500 }
		)
	}
}
