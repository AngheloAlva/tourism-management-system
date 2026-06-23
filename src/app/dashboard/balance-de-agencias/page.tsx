import { getActiveTransferAgencies } from "@/project/transfer-agencies/actions/get-active-transfer-agencies"

import { ManagementCloseView } from "@/project/transfers/components/cierre-gestion/ManagementCloseView"
import { getManagementCloseData } from "@/project/transfers/actions/get-management-close-data"

import "./print-styles.css"

const fallbackAgencies = [
	{ id: "mock-agency-1", name: "Agencia Principal" },
	{ id: "mock-agency-2", name: "Agencia Secundaria" },
]

export default async function Page() {
	let agencies = fallbackAgencies
	let initialAgencyId = agencies[0]?.id

	try {
		const agenciesData = await getActiveTransferAgencies()

		if (agenciesData.length > 0) {
			agencies = agenciesData.map((agency) => ({
				id: agency.id,
				name: agency.name,
			}))
			initialAgencyId = agencies[0]?.id
		}
	} catch (error) {
		console.error(
			"[balance-de-agencias] No se pudo acceder a la base de datos, usando mock de agencias.",
			error
		)
	}

	return (
		<div>
			<h1 className="mb-5 text-4xl font-semibold">Balance de Agencias</h1>

			<ManagementCloseView
				agencies={agencies}
				initialAgencyId={initialAgencyId}
				fetcher={getManagementCloseData}
			/>
		</div>
	)
}
