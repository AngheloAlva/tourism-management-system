import { put } from "@vercel/blob"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"

const ALLOWED_CONTENT_TYPES = [
	"application/pdf",
	"image/jpeg",
	"image/png",
	"image/webp",
]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: Request): Promise<NextResponse> {
	try {
		const session = await auth.api.getSession({ headers: await headers() })
		if (!session?.user) {
			return NextResponse.json({ error: "No autorizado" }, { status: 401 })
		}

		const canInteract = await canCurrentUserInteractPath("/traspasos")
		if (!canInteract) {
			return NextResponse.json({ error: "No tiene permisos" }, { status: 403 })
		}

		const { searchParams } = new URL(request.url)
		const filename = searchParams.get("filename")

		if (!filename) {
			return NextResponse.json({ error: "Filename is required" }, { status: 400 })
		}

		const contentType = request.headers.get("content-type") || ""
		if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
			return NextResponse.json(
				{ error: "Tipo de archivo no permitido. Use PDF, JPEG, PNG o WebP." },
				{ status: 400 }
			)
		}

		const contentLength = Number(request.headers.get("content-length") || "0")
		if (contentLength > MAX_FILE_SIZE) {
			return NextResponse.json(
				{ error: "El archivo excede el tamaño máximo de 5MB." },
				{ status: 400 }
			)
		}

		// Sanitize filename
		const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_")
		const blobPath = `transfers/proofs/${Date.now()}-${sanitizedFilename}`

		const blob = await put(blobPath, request.body as ReadableStream, {
			access: "public",
			contentType,
		})

		return NextResponse.json({
			success: true,
			url: blob.url,
			pathname: blob.pathname,
		})
	} catch (error) {
		console.error("Error uploading proof of payment:", error)
		return NextResponse.json(
			{ error: "Error al subir el archivo" },
			{ status: 500 }
		)
	}
}
