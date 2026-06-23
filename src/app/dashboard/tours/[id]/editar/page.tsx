import { getTourById } from "@/project/tours/actions/tour.actions"
import { TourForm } from "@/project/tours/components/tour-form"
import { notFound } from "next/navigation"

export default async function EditTourPage({ params }: { params: Promise<{ id: string }> }) {
	const result = await getTourById((await params).id)

	if (!result.success || !result.data) {
		notFound()
	}

	return (
		<div>
			<TourForm tour={result.data} />
		</div>
	)
}
