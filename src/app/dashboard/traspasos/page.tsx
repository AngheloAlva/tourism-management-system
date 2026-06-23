import { TransferForm } from "@/project/transfers/components/transfer-form"
import { TutorialVideosDialog } from "@/shared/components/tutorials/tutorial-videos-dialog"

export default function TraspasosPage() {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Traspasos</h1>
					<p className="text-muted-foreground mt-1">
						Gestiona los traspasos de vouchers a otras agencias
					</p>
				</div>
				<TutorialVideosDialog
					buttonLabel="Tutorial Traspasos"
					title="Cómo hacer Traspasos"
					description="Aprende a gestionar traspasos de vouchers a otras agencias."
					videos={[
						{
							title: "Traspasos",
							url: "https://youtu.be/7DNPG0w5UxE",
						},
					]}
				/>
			</div>

			<TransferForm />
		</div>
	)
}
