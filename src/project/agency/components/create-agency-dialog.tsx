"use client"

import { PlusCircleIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/shared/components/ui/button"
import { AgencyForm } from "./agency-form"
import {
	Dialog,
	DialogTitle,
	DialogHeader,
	DialogTrigger,
	DialogContent,
	DialogDescription,
} from "@/shared/components/ui/dialog"

import type { Agency } from "../types/agency"

interface CreateAgencyDialogProps {
	agency?: Agency | null
	trigger?: React.ReactNode
	open?: boolean
	onOpenChange?: (open: boolean) => void
}

export function CreateAgencyDialog({
	agency,
	trigger,
	open,
	onOpenChange,
}: CreateAgencyDialogProps) {
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
					<Button className="bg-primary text-white hover:bg-orange-600" data-testid="agency-button-create">
						<PlusCircleIcon className="h-4 w-4" />
						Nuevo Mayorista
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="max-h-[90vh] overflow-y-auto md:max-w-7xl">
				<DialogHeader>
					<DialogTitle>{agency ? "Editar Mayorista" : "Crear Nuevo Mayorista"}</DialogTitle>
					<DialogDescription>
						{agency
							? "Modifica la información del mayorista"
							: "Registra una nueva empresa mayorista que compra tours a TurismoChileTours"}
					</DialogDescription>
				</DialogHeader>
				<AgencyForm agency={agency} onSuccess={handleSuccess} />
			</DialogContent>
		</Dialog>
	)
}
