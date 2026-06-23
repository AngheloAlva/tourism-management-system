import { useAppForm } from "@/shared/components/ui/tanstack-form"
import type { ProviderFormData } from "../schemas/provider.schema"
import { providerSchema } from "../schemas/provider.schema"

/**
 * Helper function to derive the form instance type.
 * This is NEVER called at runtime -- it exists purely to extract the return type
 * of useAppForm when configured with the provider form options.
 * Named with `use` prefix to satisfy rules-of-hooks lint (it has hook signature).
 */
function useDeriveFormType() {
	return useAppForm({
		defaultValues: {} as ProviderFormData,
		validators: {
			onChange: providerSchema,
		},
	})
}

export type ProviderFormInstance = ReturnType<typeof useDeriveFormType>
