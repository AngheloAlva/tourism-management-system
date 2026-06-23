"use client"

import { Loader2, SaveIcon } from "lucide-react"
import { useStore } from "@tanstack/react-form"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { providerSchema, type ProviderFormData } from "../schemas/provider.schema"
import { useAppForm } from "@/shared/components/ui/tanstack-form"
import {
	useProvider,
	useCreateProvider,
	useUpdateProvider,
} from "../hooks/use-providers"

import { Button } from "@/shared/components/ui/button"

import { ProviderBaseInfoFields } from "./provider-base-info-fields"
import { ProviderServicesFields } from "./provider-services-fields"
import { ProviderCateringFields } from "./provider-catering-fields"
import { ProviderVehicleFields } from "./provider-vehicle-fields"
import { ProviderDriverFields } from "./provider-driver-fields"
import { ProviderGuideFields } from "./provider-guide-fields"

interface FormularioProveedoresProps {
	providerId?: string
}

export function FormularioProveedores({ providerId }: FormularioProveedoresProps) {
	const router = useRouter()
	const isEditMode = !!providerId

	const { data: provider, isLoading: loadingProvider } = useProvider(providerId)
	const createProvider = useCreateProvider()
	const updateProvider = useUpdateProvider()

	const form = useAppForm({
		defaultValues: {
			type: "NATURAL" as const,
			rut: "",
			isActive: true,
			fullName: "",
			address: "",
			phone: "",
			email: "",
			birthDate: undefined,
			companyName: "",
			category: "",
			giro: undefined,
			services: {
				conductor: false,
				maquina: false,
				transferOut: false,
				cocteleria: false,
				conductorMaquina: false,
				transferIn: false,
				guia: false,
				otros: false,
			},
			licenseType: "",
			licenseUrl: "",
			licenseRenovationDate: undefined,
			carnetUrl: "",
			carnetRenovationDate: undefined,
			sernaturRegistry: "",
			sernaturRenovationDate: undefined,
			vehicleBrand: "",
			vehicleModel: "",
			vehicleYear: "",
			vehiclePlate: "",
			vehicleCapacity: undefined,
			mileage: "",
			otherDescription: "",
			costPerDay: undefined,
			guideCost: undefined,
			driverCost: undefined,
			vehicleCost: undefined,
			transferInCost: undefined,
			transferOutCost: undefined,
			otherCost: undefined,
			catering: [],
		} as ProviderFormData,
		validators: {
			onChange: providerSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				if (isEditMode && providerId) {
					await updateProvider.mutateAsync({ id: providerId, data: value })
					toast.success("Proveedor actualizado correctamente")
				} else {
					await createProvider.mutateAsync(value)
					toast.success("Proveedor creado correctamente")
				}
				router.push("/dashboard/control-de-proveedores")
			} catch {
				toast.error(isEditMode ? "Error al actualizar el proveedor" : "Error al crear el proveedor")
			}
		},
	})

	useEffect(() => {
		if (provider && isEditMode) {
			form.setFieldValue("type", provider.type)
			form.setFieldValue("rut", provider.rut)
			form.setFieldValue("isActive", provider.isActive)
			form.setFieldValue("fullName", provider.fullName || "")
			form.setFieldValue("address", provider.address || "")
			form.setFieldValue("phone", provider.phone || "")
			form.setFieldValue("email", provider.email || "")
			form.setFieldValue("birthDate", provider.birthDate ? new Date(provider.birthDate) : undefined)
			form.setFieldValue("companyName", provider.companyName || "")
			form.setFieldValue("category", provider.category || "")
			form.setFieldValue("giro", provider.giro || undefined)
			form.setFieldValue("services.conductor", provider.conductor)
			form.setFieldValue("services.maquina", provider.maquina)
			form.setFieldValue("services.transferOut", provider.transferOut)
			form.setFieldValue("services.cocteleria", provider.cocteleria)
			form.setFieldValue("services.conductorMaquina", provider.conductorMaquina)
			form.setFieldValue("services.transferIn", provider.transferIn)
			form.setFieldValue("services.guia", provider.guia)
			form.setFieldValue("services.otros", provider.otros)
			form.setFieldValue("licenseType", provider.licenseType || "")
			form.setFieldValue("licenseUrl", provider.licenseUrl || "")
			form.setFieldValue(
				"licenseRenovationDate",
				provider.licenseRenovationDate ? new Date(provider.licenseRenovationDate) : undefined
			)
			form.setFieldValue("carnetUrl", provider.carnetUrl || "")
			form.setFieldValue(
				"carnetRenovationDate",
				provider.carnetRenovationDate ? new Date(provider.carnetRenovationDate) : undefined
			)
			form.setFieldValue("sernaturRegistry", provider.sernaturRegistry || "")
			form.setFieldValue(
				"sernaturRenovationDate",
				provider.sernaturRenovationDate ? new Date(provider.sernaturRenovationDate) : undefined
			)
			form.setFieldValue("vehicleBrand", provider.vehicleBrand || "")
			form.setFieldValue("vehicleModel", provider.vehicleModel || "")
			form.setFieldValue("vehicleYear", provider.vehicleYear?.toString() || "")
			form.setFieldValue("vehiclePlate", provider.vehiclePlate || "")
			form.setFieldValue("vehicleCapacity", provider.vehicleCapacity || undefined)
			form.setFieldValue("mileage", provider.mileage || "")
			form.setFieldValue("otherDescription", provider.otherDescription || "")
			form.setFieldValue("costPerDay", provider.costPerDay || undefined)
			form.setFieldValue("guideCost", provider.guideCost || undefined)
			form.setFieldValue("driverCost", provider.driverCost || undefined)
			form.setFieldValue("vehicleCost", provider.vehicleCost || undefined)
			form.setFieldValue("transferInCost", provider.transferInCost || undefined)
			form.setFieldValue("transferOutCost", provider.transferOutCost || undefined)
			form.setFieldValue("otherCost", provider.otherCost || undefined)
		}
	}, [provider, isEditMode, form])

	const formValues = useStore(form.store, (state) => state.values)
	const { services, type } = formValues

	const mostrarCamposConductor = services.conductor || services.conductorMaquina
	const mostrarCamposGuia = services.guia
	const mostrarCamposVehiculo = services.maquina || services.conductorMaquina
	const mostrarCamposCatering = services.cocteleria

	if (loadingProvider) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<div className="text-center">
					<Loader2 className="text-primary mx-auto h-8 w-8 animate-spin" />
					<p className="text-muted-foreground mt-4">Cargando proveedor...</p>
				</div>
			</div>
		)
	}

	const isSubmitting = createProvider.isPending || updateProvider.isPending

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault()
				e.stopPropagation()
				form.handleSubmit()
			}}
			className="space-y-6"
		>
			<ProviderBaseInfoFields
				form={form}
				type={type}
				mostrarCamposConductor={mostrarCamposConductor}
			/>

			<ProviderServicesFields form={form} services={services} />

			{mostrarCamposCatering && <ProviderCateringFields form={form} />}

			{mostrarCamposVehiculo && <ProviderVehicleFields form={form} />}

			{mostrarCamposConductor && <ProviderDriverFields form={form} />}

			{mostrarCamposGuia && <ProviderGuideFields form={form} />}

			<div className="flex justify-end gap-4">
				<Button
					type="button"
					variant="outline"
					onClick={() => router.push("/dashboard/control-de-proveedores")}
					disabled={isSubmitting}
				>
					Cancelar
				</Button>
				<Button type="submit" disabled={isSubmitting} data-testid="provider-button-form-submit">
					{isSubmitting ? (
						<>
							<Loader2 className="h-4 w-4 animate-spin" />
							{isEditMode ? "Actualizando..." : "Guardando..."}
						</>
					) : (
						<>
							<SaveIcon className="h-4 w-4" />
							{isEditMode ? "Actualizar Proveedor" : "Guardar Proveedor"}
						</>
					)}
				</Button>
			</div>
		</form>
	)
}
