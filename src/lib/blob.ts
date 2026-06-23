import { put } from "@vercel/blob"

import { IS_DEMO } from "./demo"

interface UploadBlobOptions {
	contentType: string
	// @vercel/blob@2.x put() only supports public blobs.
	access?: "public"
}

interface UploadBlobResult {
	url: string
	pathname: string
	simulated?: true
}

/**
 * Thin wrapper around Vercel Blob `put()`.
 *
 * In demo mode the upload is intercepted — no HTTP call is made to Vercel Blob.
 * A deterministic placeholder URL is returned instead and `simulated: true` is
 * set so the caller can surface "simulado en modo demo" feedback in the UI.
 *
 * PDF and Excel exports are NOT routed through this wrapper — they are
 * in-process local operations and should remain real in all modes.
 */
export async function uploadBlob(
	blobPath: string,
	body: ReadableStream | Buffer | Uint8Array,
	opts: UploadBlobOptions,
): Promise<UploadBlobResult> {
	if (IS_DEMO) {
		return {
			url: `https://demo-placeholder.atacama-demo.cl/${blobPath}`,
			pathname: blobPath,
			simulated: true,
		}
	}

	const blob = await put(blobPath, body as ReadableStream, {
		access: opts.access ?? "public",
		contentType: opts.contentType,
	})

	return {
		url: blob.url,
		pathname: blob.pathname,
	}
}
