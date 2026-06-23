import { EditReceptionWrapper } from "@/project/receptions/components/edit-reception-wrapper"

export default async function EditReceptionPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Editar Recepción</h1>
				<p className="text-muted-foreground mt-1">
					Modificá los datos de la recepción existente
				</p>
			</div>

			<EditReceptionWrapper id={id} />
		</div>
	)
}
