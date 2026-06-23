"use client"

import { useState } from "react"
import { RefreshCwIcon, AlertTriangleIcon } from "lucide-react"
import { toast } from "sonner"

import { regenerateBackupCodesAction } from "../../actions/two-factor.actions"
import { BackupCodesDisplay } from "./backup-codes-display"

import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import {
	Dialog,
	DialogTitle,
	DialogHeader,
	DialogContent,
	DialogDescription,
	DialogFooter,
} from "@/shared/components/ui/dialog"

type RegenerateStep = "password" | "codes"

interface RegenerateBackupCodesDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onSuccess?: () => void
}

export function RegenerateBackupCodesDialog({
	open,
	onOpenChange,
	onSuccess,
}: RegenerateBackupCodesDialogProps) {
	const [step, setStep] = useState<RegenerateStep>("password")
	const [password, setPassword] = useState("")
	const [newCodes, setNewCodes] = useState<string[]>([])
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const resetState = () => {
		setStep("password")
		setPassword("")
		setNewCodes([])
		setIsSubmitting(false)
		setError(null)
	}

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			resetState()
		}
		onOpenChange(nextOpen)
	}

	const handleSubmit = async () => {
		setError(null)
		setIsSubmitting(true)

		try {
			const result = await regenerateBackupCodesAction({ password })

			if (!result.ok) {
				setError(result.error ?? "Error al regenerar los códigos")
				return
			}

			setNewCodes(result.data!.backupCodes)
			setStep("codes")
		} catch {
			setError("Error inesperado. Intentá de nuevo.")
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleFinish = () => {
		toast.success("Códigos de respaldo regenerados correctamente")
		onSuccess?.()
		handleOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[480px]">
				{step === "password" && (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<RefreshCwIcon className="h-5 w-5" />
								Regenerar códigos de respaldo
							</DialogTitle>
							<DialogDescription>
								Se generarán nuevos códigos de respaldo para tu cuenta.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4 py-2">
							<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
								<AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
								<p>
									<span className="font-medium">Tus códigos anteriores serán invalidados.</span>{" "}
									Asegurate de guardar los nuevos códigos en un lugar seguro antes de cerrar este diálogo.
								</p>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="regen-password">Contraseña actual</Label>
								<Input
									id="regen-password"
									type="password"
									className="h-10"
									placeholder="Tu contraseña actual"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && password.length > 0) {
											void handleSubmit()
										}
									}}
									autoFocus
								/>
							</div>

							{error && (
								<div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
									<AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
									{error}
								</div>
							)}
						</div>

						<DialogFooter>
							<Button variant="outline" onClick={() => handleOpenChange(false)}>
								Cancelar
							</Button>
							<Button
								onClick={handleSubmit}
								disabled={password.length === 0 || isSubmitting}
							>
								{isSubmitting ? "Generando..." : "Regenerar códigos"}
							</Button>
						</DialogFooter>
					</>
				)}

				{step === "codes" && (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<RefreshCwIcon className="h-5 w-5 text-green-600" />
								Nuevos códigos de respaldo
							</DialogTitle>
							<DialogDescription>
								Tus códigos anteriores ya no son válidos. Guardá estos nuevos códigos antes de cerrar.
							</DialogDescription>
						</DialogHeader>

						<div className="py-2">
							<BackupCodesDisplay codes={newCodes} />
						</div>

						<DialogFooter>
							<Button onClick={handleFinish}>Listo</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	)
}
