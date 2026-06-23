import { Card, CardContent, CardHeader } from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"

interface InsightsSkeletonProps {
	count?: number
}

export function InsightsSkeleton({ count = 3 }: InsightsSkeletonProps) {
	return (
		<div className={`grid gap-4 ${count === 3 ? "md:grid-cols-3" : count === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2"}`}>
			{Array.from({ length: count }).map((_, index) => (
				<Card key={index}>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-8 w-8 rounded-full" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-8 w-32 mb-2" />
						<Skeleton className="h-3 w-40" />
					</CardContent>
				</Card>
			))}
		</div>
	)
}
