import { InsightsSkeleton } from "@/shared/components/ui/insights-skeleton"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { Card, CardContent } from "@/shared/components/ui/card"

interface ModuleLoadingSkeletonProps {
	titleWidthClassName?: string
	descriptionWidthClassName?: string
}

export function ModuleLoadingSkeleton({
	titleWidthClassName = "w-[340px]",
	descriptionWidthClassName = "w-[410px]",
}: ModuleLoadingSkeletonProps) {
	return (
		<div className="space-y-6">
			<section>
				<div className="space-y-2">
					<Skeleton className={`h-9 ${titleWidthClassName}`} />
					<Skeleton className={`h-4 ${descriptionWidthClassName}`} />
				</div>
			</section>

			<InsightsSkeleton count={4} />

			<Card className="gap-4">
				<CardContent className="space-y-4 p-6">
					<div className="grid gap-3 lg:grid-cols-2">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
					<div className="space-y-2">
						{Array.from({ length: 8 }).map((_, index) => (
							<Skeleton key={index} className="h-10 w-full" />
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
