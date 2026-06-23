import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { uploadBlob } from "@/lib/blob"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
// Exact MIME allowlist. SVG is deliberately excluded: it can carry inline
// scripts and these blobs are served publicly, so allowing it would enable
// stored XSS.
const ALLOWED_CONTENT_TYPES = [
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif",
]

export async function POST(request: Request): Promise<NextResponse> {
	try {
		// Shared blob uploader used by tours, provider vehicles and sale payment
		// receipts. Authentication is enough — module-level permission is enforced
		// by the pages that mount the uploader, not by this generic endpoint.
		const session = await auth.api.getSession({ headers: await headers() })
		if (!session?.user) {
			return NextResponse.json({ error: "No autorizado" }, { status: 401 })
		}

		const { searchParams } = new URL(request.url)
		const filename = searchParams.get("filename")
		const language = searchParams.get("language")

		if (!filename) {
			return NextResponse.json({ error: "Filename is required" }, { status: 400 })
		}

		if (!language || !["es", "en", "pt"].includes(language)) {
			return NextResponse.json(
				{ error: "Valid language is required (es, en, pt)" },
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

		// The browser sets Content-Type to the file's MIME type when a File is sent
		// as the request body. Persist that real type (PDF or image) instead of
		// forcing application/pdf, otherwise images upload with the wrong type.
		const contentType = request.headers.get("content-type") ?? "application/octet-stream"
		if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
			return NextResponse.json(
				{ error: "Solo se permiten archivos PDF o imágenes." },
				{ status: 400 }
			)
		}

		const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_")
		const blobPath = `tours/${language}/${Date.now()}-${sanitizedFilename}`

		const blob = await uploadBlob(blobPath, request.body as ReadableStream, {
			contentType,
		})

		return NextResponse.json({
			success: true,
			url: blob.url,
			pathname: blob.pathname,
			...(blob.simulated ? { simulated: true, message: "simulado en modo demo" } : {}),
		})
	} catch (error) {
		console.error("Error uploading PDF:", error)
		return NextResponse.json(
			{ error: "Error al subir el archivo" },
			{ status: 500 }
		)
	}
}
