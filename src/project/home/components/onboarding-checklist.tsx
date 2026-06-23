"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
	ArrowRight,
	Building2,
	CheckCircle2,
	Circle,
	MapPinned,
	UserPlus,
	Users,
	X,
	Receipt,
} from "lucide-react"

import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { cn } from "@/lib/utils"

import { useOnboardingStatus } from "../hooks/use-home"

const DISMISS_STORAGE_KEY = "turismo:onboarding-checklist-dismissed"

interface OnboardingStep {
	id: string
	label: string
	description: string
	href: string
	icon: typeof Building2
	done: boolean
}

export function OnboardingChecklist() {
	const { data, isLoading } = useOnboardingStatus()
	const [dismissed, setDismissed] = useState(true)

	useEffect(() => {
		setDismissed(window.localStorage.getItem(DISMISS_STORAGE_KEY) === "true")
	}, [])

	if (isLoading || !data || dismissed) return null

	const steps: OnboardingStep[] = [
		{
			id: "tour",
			label: "Crear tu primer tour",
			description: "El catálogo de servicios que vas a vender.",
			href: "/dashboard/tours",
			icon: MapPinned,
			done: data.hasTour,
		},
		{
			id: "provider",
			label: "Cargar un proveedor",
			description: "Guías, conductores o vehículos para asignar a eventos.",
			href: "/dashboard/control-de-proveedores",
			icon: Users,
			done: data.hasProvider,
		},
		{
			id: "agency",
			label: "Registrar un mayorista",
			description: "Empresas externas que compran tus tours (para facturar).",
			href: "/dashboard/gestion-de-mayoristas",
			icon: Building2,
			done: data.hasAgency,
		},
		{
			id: "sale",
			label: "Registrar tu primera venta",
			description: "Probá el flujo completo: cliente, tour, pasajeros y pago.",
			href: "/dashboard/registro-de-ventas",
			icon: Receipt,
			done: data.hasSale,
		},
		{
			id: "user",
			label: "Sumar otro usuario al equipo",
			description: "Vendedores que también van a operar el sistema.",
			href: "/dashboard/usuarios",
			icon: UserPlus,
			done: data.hasExtraUser,
		},
	]

	const completedCount = steps.filter((step) => step.done).length

	// Si está todo listo no mostramos la card aunque no se haya descartado
	if (completedCount === steps.length) return null

	const handleDismiss = () => {
		window.localStorage.setItem(DISMISS_STORAGE_KEY, "true")
		setDismissed(true)
	}

	return (
		<Card className="border-primary/20 bg-primary/5 relative">
			<button
				onClick={handleDismiss}
				className="text-muted-foreground hover:bg-background absolute top-3 right-3 rounded-md p-1 transition-colors"
				aria-label="Descartar checklist de inicio"
				type="button"
			>
				<X className="h-4 w-4" />
			</button>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-lg">
					Primeros pasos
				</CardTitle>
				<CardDescription>
					{completedCount} de {steps.length} completos — completá estos puntos para tener el sistema operativo.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="space-y-2">
					{steps.map((step) => {
						const Icon = step.icon
						return (
							<li key={step.id}>
								<Link
									href={step.href}
									className={cn(
										"hover:bg-background flex items-center gap-3 rounded-md p-2 transition-colors",
										step.done && "opacity-60"
									)}
								>
									{step.done ? (
										<CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
									) : (
										<Circle className="text-muted-foreground h-5 w-5 shrink-0" />
									)}
									<Icon className="text-muted-foreground h-4 w-4 shrink-0" />
									<div className="flex-1 min-w-0">
										<p
											className={cn(
												"text-sm font-medium",
												step.done && "line-through"
											)}
										>
											{step.label}
										</p>
										<p className="text-muted-foreground text-xs">{step.description}</p>
									</div>
									{!step.done && (
										<ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />
									)}
								</Link>
							</li>
						)
					})}
				</ul>
				<div className="mt-4 flex justify-end">
					<Button variant="ghost" size="sm" onClick={handleDismiss}>
						No mostrar más
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
