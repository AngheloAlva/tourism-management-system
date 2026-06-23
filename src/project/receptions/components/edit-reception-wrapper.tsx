"use client"

import { useMemo } from "react"
import { notFound } from "next/navigation"

import { useReception } from "../hooks/use-receptions"
import { ReceptionForm } from "./reception-form"
import { ModuleLoadingSkeleton } from "@/shared/components/ui/module-loading-skeleton"
import { mapReceptionToFormData } from "../utils/reception-form-mappers"

import type { ReceptionFormData } from "../schemas/reception.schema"

interface EditReceptionWrapperProps {
	id: string
}

export function EditReceptionWrapper({ id }: EditReceptionWrapperProps) {
	const { data: reception, isLoading, error } = useReception(id)

	const initialData = useMemo<ReceptionFormData | undefined>(() => {
		if (!reception) return undefined
		return mapReceptionToFormData(reception)
	}, [reception])

	if (isLoading) {
		return <ModuleLoadingSkeleton />
	}

	if (error || !reception || reception.status === "CANCELLED") {
		notFound()
	}

	return (
		<ReceptionForm
			initialData={initialData}
			mode="edit"
			receptionId={id}
		/>
	)
}
