import dynamic from "next/dynamic"

import { UpcomingEvents } from "@/project/home/components/upcoming-events"
import { DashboardKPIs } from "@/project/home/components/dashboard-kpis"
import { OnboardingChecklist } from "@/project/home/components/onboarding-checklist"
import { RecentSales } from "@/project/home/components/recent-sales"
import { TutorialVideosDialog } from "@/shared/components/tutorials/tutorial-videos-dialog"

const SalesChart = dynamic(() =>
	import("@/project/home/components/sales-chart").then((m) => ({
		default: m.SalesChart,
	}))
)

export default function Page() {
	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<div className="flex items-center justify-end">
				<TutorialVideosDialog
					buttonLabel="Tutorial Inicio"
					title="Explicación General del Sistema"
					description="Video de introducción para el uso general del dashboard."
					videos={[
						{
							title: "Explicación General de sistema",
							url: "https://youtu.be/iuqO2TLIblM",
						},
					]}
				/>
			</div>

			<OnboardingChecklist />
			<DashboardKPIs />
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
				<div className="col-span-4 grid gap-4">
					<SalesChart />
					<RecentSales />
				</div>

				<div className="col-span-4 grid gap-4 md:col-span-3">
					<UpcomingEvents />
				</div>
			</div>
		</div>
	)
}
