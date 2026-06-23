"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheckIcon, ShieldIcon } from "lucide-react"

import { EnableTwoFactorDialog } from "./enable-two-factor-dialog"
import { DisableTwoFactorDialog } from "./disable-two-factor-dialog"
import { RegenerateBackupCodesDialog } from "./regenerate-backup-codes-dialog"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"

interface TwoFactorSectionProps {
	twoFactorEnabled: boolean
}

export function TwoFactorSection({ twoFactorEnabled }: TwoFactorSectionProps) {
	const router = useRouter()

	const [enableOpen, setEnableOpen] = useState(false)
	const [disableOpen, setDisableOpen] = useState(false)
	const [regenerateOpen, setRegenerateOpen] = useState(false)

	const handleToggleSuccess = () => {
		router.refresh()
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						{twoFactorEnabled ? (
							<ShieldCheckIcon className="h-5 w-5 text-green-600" />
						) : (
							<ShieldIcon className="h-5 w-5" />
						)}
						Autenticación de dos factores
					</CardTitle>
					{twoFactorEnabled && <Badge variant="default">Activo</Badge>}
				</div>
				<CardDescription>
					Agregá una capa extra de seguridad a tu cuenta. Con la autenticación de dos factores,
					necesitarás un código de tu app autenticadora además de tu contraseña.
				</CardDescription>
			</CardHeader>

			<CardContent>
				{twoFactorEnabled ? (
					<div className="flex flex-wrap gap-2">
						<Button variant="destructive" size="sm" onClick={() => setDisableOpen(true)}>
							Desactivar
						</Button>
						<Button variant="outline" size="sm" onClick={() => setRegenerateOpen(true)}>
							Regenerar códigos de respaldo
						</Button>
					</div>
				) : (
					<Button onClick={() => setEnableOpen(true)}>
						Activar autenticación de dos factores
					</Button>
				)}
			</CardContent>

			<EnableTwoFactorDialog
				open={enableOpen}
				onOpenChange={setEnableOpen}
				onSuccess={handleToggleSuccess}
			/>

			<DisableTwoFactorDialog
				open={disableOpen}
				onOpenChange={setDisableOpen}
				onSuccess={handleToggleSuccess}
			/>

			<RegenerateBackupCodesDialog
				open={regenerateOpen}
				onOpenChange={setRegenerateOpen}
				onSuccess={handleToggleSuccess}
			/>
		</Card>
	)
}
