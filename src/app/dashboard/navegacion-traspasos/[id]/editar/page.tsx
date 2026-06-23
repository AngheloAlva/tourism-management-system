import { EditTransferWrapper } from "@/project/transfers/components/edit-transfer-wrapper"

export default async function EditTransferPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Editar Traspaso</h1>
				<p className="text-muted-foreground mt-1">Modifica los datos del traspaso</p>
			</div>
			<EditTransferWrapper id={id} />
		</div>
	)
}
