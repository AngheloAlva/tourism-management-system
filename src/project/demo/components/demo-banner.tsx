"use client"

import { useState } from "react"
import { resetDemo } from "@/project/demo/actions/reset.actions"

/**
 * Sticky banner shown at the top of the dashboard in demo mode.
 * Surfaces the "simulado en modo demo" label and provides the reset trigger.
 */
export default function DemoBanner() {
	const [loading, setLoading] = useState(false)
	const [message, setMessage] = useState<string | null>(null)

	async function handleReset() {
		setLoading(true)
		setMessage(null)
		try {
			const result = await resetDemo()
			if (result.success) {
				setMessage("Demo reiniciado correctamente.")
				// Reload the page so the fresh PGlite client is used
				window.location.reload()
			} else {
				setMessage(`Error: ${result.error}`)
			}
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="bg-yellow-100 border-b border-yellow-300 px-4 py-2 text-sm text-yellow-900 flex items-center justify-between gap-4">
			<span>
				<strong>Modo Demo</strong> — Los datos son ficticios y los servicios externos están{" "}
				<em>simulados en modo demo</em>.
			</span>
			<div className="flex items-center gap-3 shrink-0">
				{message && <span className="text-xs">{message}</span>}
				<button
					onClick={handleReset}
					disabled={loading}
					className="px-3 py-1 rounded bg-yellow-600 text-white text-xs font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors"
				>
					{loading ? "Reiniciando..." : "Reiniciar demo"}
				</button>
			</div>
		</div>
	)
}
