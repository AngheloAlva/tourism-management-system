"use client"

import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { collectFormErrors } from "@/shared/utils/collect-form-errors"

interface ErrorSummaryProps {
	formState: {
		fieldMeta: Partial<Record<string, { errors?: unknown[] } | undefined>>
		submissionAttempts: number
	}
}

export function ErrorSummary({ formState }: ErrorSummaryProps) {
	if (formState.submissionAttempts === 0) return null

	const uniqueErrors = collectFormErrors(formState.fieldMeta)

	if (uniqueErrors.length === 0) return null

	return (
		<Alert variant="destructive">
			<AlertCircle className="h-4 w-4" />
			<AlertTitle>Errores en el formulario</AlertTitle>
			<AlertDescription>
				<ul className="list-disc pl-4 mt-2 space-y-1">
					{uniqueErrors.map((error, i) => (
						<li key={i} className="text-sm">{error}</li>
					))}
				</ul>
			</AlertDescription>
		</Alert>
	)
}
