import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { renderToStream } from "@react-pdf/renderer"
import React from "react"

import { auth } from "@/lib/auth"
import { canCurrentUserAccessPath } from "@/project/roles/actions/role.actions"
import { getReceptionById } from "@/project/receptions/actions/reception.actions"

import { ReceptionVoucherPDF } from "@/project/receptions/components/reception-voucher-pdf"

import type { Language } from "@/project/sales/utils/voucher-translations"

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth.api.getSession({ headers: await headers() })
		if (!session?.user) {
			return NextResponse.json({ message: "No autorizado" }, { status: 401 })
		}

		const canAccess = await canCurrentUserAccessPath("/recepcion")
		if (!canAccess) {
			return NextResponse.json({ message: "No tiene permisos" }, { status: 403 })
		}

		const reception = await getReceptionById((await params).id)

		if (!reception) {
			return NextResponse.json({ error: "Recepción no encontrada" }, { status: 404 })
		}

		const { searchParams } = new URL(request.url)
		const language = (searchParams.get("lang") || "es") as Language
		const includePrice = searchParams.get("includePrice") !== "false"

		const stream = await renderToStream(
			React.createElement(ReceptionVoucherPDF, { reception, language, includePrice })
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
				"Content-Disposition": `attachment; filename="voucher-recepcion-${reception.voucher}${languageSuffix}.pdf"`,
			},
		})
	} catch (error) {
		console.error("Error generando voucher de recepción:", error)
		return NextResponse.json({ error: "Error al generar el voucher" }, { status: 500 })
	}
}
