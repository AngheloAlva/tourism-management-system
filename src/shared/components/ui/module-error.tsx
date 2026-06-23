"use client"

import { AlertCircle } from "lucide-react"

import { Button } from "@/shared/components/ui/button"

interface ModuleErrorProps {
	error: Error & { digest?: string }
	reset: () => void
}

export function ModuleError({ error, reset }: ModuleErrorProps) {
	return (
		<div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
			<AlertCircle className="text-destructive h-12 w-12" />
			<div className="text-center">
				<h2 className="text-lg font-semibold">Algo salió mal</h2>
				<p className="text-muted-foreground text-sm">
					{error.message || "Ocurrió un error inesperado"}
				</p>
			</div>
			<Button variant="outline" onClick={reset}>
				Intentar de nuevo
			</Button>
		</div>
	)
}
