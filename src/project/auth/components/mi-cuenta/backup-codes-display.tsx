"use client"

import { useState } from "react"
import { CopyIcon, CheckIcon, DownloadIcon, AlertTriangleIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/shared/components/ui/button"

interface BackupCodesDisplayProps {
	codes: string[]
}

export function BackupCodesDisplay({ codes }: BackupCodesDisplayProps) {
	const [copied, setCopied] = useState(false)

	const handleCopyAll = async () => {
		try {
			await navigator.clipboard.writeText(codes.join("\n"))
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			toast.error("No se pudo copiar al portapapeles")
		}
	}

	const handleDownload = () => {
		const content = [
			"Códigos de respaldo — Autenticación de dos factores",
			"TurismoChileTours",
			"",
			"Guardá estos códigos en un lugar seguro.",
			"Cada código solo puede usarse una vez.",
			"",
			...codes,
		].join("\n")

		const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
		const url = URL.createObjectURL(blob)
		const link = document.createElement("a")
		link.href = url
		link.download = "turismo-backup-codes.txt"
		link.click()
		URL.revokeObjectURL(url)
	}

	return (
		<div className="space-y-4">
			<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
				<AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
				<p>
					<span className="font-medium">Guardá estos códigos en un lugar seguro.</span>{" "}
					No se mostrarán de nuevo. Cada código se puede usar una sola vez si perdés acceso a tu app de autenticación.
				</p>
			</div>

			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
				{codes.map((code) => (
					<code
						key={code}
						className="bg-muted flex items-center justify-center rounded-md px-3 py-2 font-mono text-sm tracking-widest"
					>
						{code}
					</code>
				))}
			</div>

			<div className="flex gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="flex-1"
					onClick={handleCopyAll}
				>
					{copied ? (
						<>
							<CheckIcon className="mr-2 h-4 w-4 text-green-600" />
							Copiados
						</>
					) : (
						<>
							<CopyIcon className="mr-2 h-4 w-4" />
							Copiar todos
						</>
					)}
				</Button>

				<Button
					type="button"
					variant="outline"
					size="sm"
					className="flex-1"
					onClick={handleDownload}
				>
					<DownloadIcon className="mr-2 h-4 w-4" />
					Descargar .txt
				</Button>
			</div>
		</div>
	)
}
