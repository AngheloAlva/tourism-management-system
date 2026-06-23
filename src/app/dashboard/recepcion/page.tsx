import { ReceptionForm } from "@/project/receptions/components/reception-form"
import { TutorialVideosDialog } from "@/shared/components/tutorials/tutorial-videos-dialog"

export default function ReceptionPage() {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Recepción</h1>
					<p className="text-muted-foreground mt-1">
						Gestiona los eventos recibidos de otras agencias
					</p>
				</div>

				<TutorialVideosDialog
					buttonLabel="Tutorial Recepciones"
					title="Cómo gestionar Recepciones"
					description="Aprende a gestionar eventos recibidos de otras agencias."
					videos={[
						{
							title: "Recepciones",
							url: "https://youtu.be/JODgx--tdTY",
						},
					]}
				/>
			</div>

			<ReceptionForm />
		</div>
	)
}
