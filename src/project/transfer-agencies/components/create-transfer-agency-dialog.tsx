"use client"

import { PlusCircleIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/shared/components/ui/button"
import { TransferAgencyForm } from "./transfer-agency-form"
import {
	Dialog,
	DialogTitle,
	DialogHeader,
	DialogTrigger,
	DialogContent,
	DialogDescription,
} from "@/shared/components/ui/dialog"

import type { TransferAgency } from "../types/transfer-agency"

interface CreateTransferAgencyDialogProps {
	agency?: TransferAgency | null
	trigger?: React.ReactNode
	open?: boolean
	onOpenChange?: (open: boolean) => void
}

export function CreateTransferAgencyDialog({
	agency,
	trigger,
	open,
	onOpenChange,
}: CreateTransferAgencyDialogProps) {
	const [internalOpen, setInternalOpen] = useState(false)
	const isControlled = typeof open === "boolean"
	const dialogOpen = isControlled ? open : internalOpen

	const handleOpenChange = (nextOpen: boolean) => {
		if (!isControlled) {
			setInternalOpen(nextOpen)
		}
		onOpenChange?.(nextOpen)
	}

	const handleSuccess = () => {
		handleOpenChange(false)
	}

	return (
		<Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				{trigger || (
					<Button className="bg-primary text-white hover:bg-orange-600">
						<PlusCircleIcon className="h-4 w-4" />
						Nueva Agencia
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="max-h-[90vh] overflow-y-auto md:max-w-3xl">
				<DialogHeader>
					<DialogTitle>{agency ? "Editar Agencia" : "Crear Nueva Agencia"}</DialogTitle>
					<DialogDescription>
						{agency
							? "Modifica la información de la agencia receptiva"
							: "Registra una nueva agencia para traspasos y recepciones"}
					</DialogDescription>
				</DialogHeader>
				<TransferAgencyForm agency={agency} onSuccess={handleSuccess} />
			</DialogContent>
		</Dialog>
	)
}
