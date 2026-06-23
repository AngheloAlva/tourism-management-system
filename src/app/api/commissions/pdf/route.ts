import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { renderToStream } from "@react-pdf/renderer"

import { auth } from "@/lib/auth"
import { canCurrentUserAccessPath } from "@/project/roles/actions/role.actions"
import { getCommissionPdfData } from "@/project/commissions/actions/commission.actions"
import { CommissionPdf } from "@/project/commissions/components/commission-pdf"
import { CommissionKind } from "@/generated/prisma/enums"

export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() })
		if (!session?.user) {
			return NextResponse.json({ message: "No autorizado" }, { status: 401 })
		}

		const canAccess = await canCurrentUserAccessPath("/comisiones")
		if (!canAccess) {
			return NextResponse.json({ message: "No tiene permisos" }, { status: 403 })
		}

		const { searchParams } = new URL(request.url)
		const operatorId = searchParams.get("operatorId")
		const startDate = searchParams.get("startDate")
		const endDate = searchParams.get("endDate")
		const percentage = searchParams.get("percentage")
		const kindParam = searchParams.get("kind")

		if (!operatorId || !startDate || !endDate || !percentage || !kindParam) {
			return NextResponse.json(
				{ message: "Faltan parámetros: operatorId, startDate, endDate, percentage, kind" },
				{ status: 400 }
			)
		}

		if (kindParam !== CommissionKind.REGULAR && kindParam !== CommissionKind.SPECIAL) {
			return NextResponse.json(
				{ message: "El parámetro kind debe ser REGULAR o SPECIAL" },
				{ status: 400 }
			)
		}

		const kind = kindParam as CommissionKind

		const parsedPercentage = Number.parseFloat(percentage)
		// SPECIAL allows percentage = 0 (PDF rendered with blank commission cells, filled by hand).
		// REGULAR still requires a positive percentage.
		const isSpecial = kind === CommissionKind.SPECIAL
		if (
			Number.isNaN(parsedPercentage) ||
			parsedPercentage < 0 ||
			(!isSpecial && parsedPercentage <= 0)
		) {
			return NextResponse.json(
				{
					message: isSpecial
						? "El porcentaje no puede ser negativo"
						: "El porcentaje debe ser un número mayor a 0",
				},
				{ status: 400 }
			)
		}

		const data = await getCommissionPdfData({
			operatorId,
			startDate: new Date(startDate),
			endDate: new Date(endDate),
			percentage: parsedPercentage,
			kind,
		})

		if (data.sales.length === 0) {
			return NextResponse.json(
				{ message: "No hay ventas para generar el PDF de comisiones" },
				{ status: 404 }
			)
		}

		const pdfDocument = CommissionPdf({
			operator: data.operator,
			period: data.period,
			sales: data.sales,
			percentage: data.percentage,
			kind: data.kind,
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
		const operatorSlug = data.operator.name.replace(/\s+/g, "-").toLowerCase()
		// REGULAR → pre-existing convention: "comision-{slug}-{dates}.pdf" (singular)
		// SPECIAL → "comisiones-especiales-{slug}-{dates}.pdf" (plural, per spec)
		const filename =
			kind === CommissionKind.SPECIAL
				? `comisiones-especiales-${operatorSlug}-${startDateLabel}-${endDateLabel}.pdf`
				: `comision-${operatorSlug}-${startDateLabel}-${endDateLabel}.pdf`

		return new NextResponse(buffer, {
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="${filename}"`,
			},
		})
	} catch (error) {
		console.error("Error generando PDF de comisiones:", error)
		return NextResponse.json(
			{ message: "Error al generar el PDF" },
			{ status: 500 }
		)
	}
}
