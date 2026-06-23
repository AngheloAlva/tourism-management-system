import { Skeleton } from "@/shared/components/ui/skeleton"
import { Card, CardContent } from "@/shared/components/ui/card"

const DAY_COLUMNS = 7
const WEEK_ROWS = 5

export default function CalendarPageLoading() {
	return (
		<div className="space-y-6">
			{/* Page title + filter bar */}
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div className="space-y-2">
					<Skeleton className="h-9 w-72" />
					<Skeleton className="h-4 w-96" />
				</div>

				<div className="flex flex-wrap items-center justify-end gap-2">
					{/* Switch pill */}
					<Skeleton className="h-8 w-32 rounded-full" />
					{/* Tour multiselect */}
					<Skeleton className="h-8 w-[250px] rounded-md" />
					{/* Filter dropdown */}
					<Skeleton className="h-8 w-28 rounded-md" />
				</div>
			</div>

			{/* Stat cards — 4 columns matching xl:grid-cols-4 */}
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Card key={i}>
						<CardContent className="flex items-center gap-4 p-6">
							<Skeleton className="h-10 w-10 rounded-full" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-7 w-12" />
								<Skeleton className="h-3 w-32" />
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{/* Calendar section */}
			<div className="flex gap-4">
				{/* Calendar area */}
				<div className="min-w-0 flex-1 space-y-4">
					{/* CalendarViewHeader skeleton */}
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						{/* Month title */}
						<Skeleton className="h-8 w-48" />

						{/* Controls: action buttons + nav + view toggle */}
						<div className="flex items-center gap-2">
							{/* Auto-assign button */}
							<Skeleton className="h-9 w-32 rounded-md" />
							{/* Export button */}
							<Skeleton className="h-9 w-32 rounded-md" />
							{/* Selection button */}
							<Skeleton className="h-9 w-28 rounded-md" />
							{/* Prev / Next / Today */}
							<Skeleton className="h-9 w-9 rounded-md" />
							<Skeleton className="h-9 w-9 rounded-md" />
							<Skeleton className="h-9 w-16 rounded-md" />
							{/* Separator gap */}
							<div className="mx-2" />
							{/* View mode toggle group — 4 pills */}
							<div className="flex gap-1">
								{["Día", "Semana", "Mes", "Proveedores"].map((label) => (
									<Skeleton key={label} className="h-8 w-16 rounded-md" />
								))}
							</div>
						</div>
					</div>

					{/* Legend row */}
					<div className="flex flex-wrap items-center gap-4">
						{Array.from({ length: 3 }).map((_, i) => (
							<div key={i} className="flex items-center gap-1.5">
								<Skeleton className="h-3 w-3 rounded-sm" />
								<Skeleton className="h-3 w-20" />
							</div>
						))}
					</div>

					{/* Month grid */}
					<div className="overflow-hidden rounded-lg border">
						{/* Day-name header row */}
						<div className="grid grid-cols-7 border-b">
							{Array.from({ length: DAY_COLUMNS }).map((_, i) => (
								<div key={i} className="flex justify-center p-2">
									<Skeleton className="h-4 w-8" />
								</div>
							))}
						</div>

						{/* Calendar cells — 5 × 7 */}
						{Array.from({ length: WEEK_ROWS }).map((_, rowIdx) => (
							<div key={rowIdx} className="grid grid-cols-7">
								{Array.from({ length: DAY_COLUMNS }).map((_, colIdx) => (
									<div
										key={colIdx}
										className="min-h-24 border-b border-r p-1 last:border-r-0"
									>
										{/* Day number */}
										<Skeleton className="mb-1 h-5 w-6 rounded" />
										{/* Occasional event chips */}
										{(rowIdx + colIdx) % 3 === 0 && (
											<Skeleton className="h-5 w-full rounded" />
										)}
										{(rowIdx * 2 + colIdx) % 5 === 0 && (
											<Skeleton className="mt-1 h-5 w-4/5 rounded" />
										)}
									</div>
								))}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}
