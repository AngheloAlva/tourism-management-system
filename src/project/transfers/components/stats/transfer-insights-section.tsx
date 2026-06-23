"use client"

import { useTransfers } from "../../hooks/use-transfers"

import { TransferInsights } from "./transfer-insights"
import { InsightsSkeleton } from "@/shared/components/ui/insights-skeleton"

export function TransferInsightsSection() {
	const { data: paginatedTransfers, isLoading } = useTransfers()

	if (isLoading) {
		return <InsightsSkeleton count={4} />
	}

	const transfers = paginatedTransfers?.data
	if (!transfers || transfers.length === 0) {
		return null
	}

	return <TransferInsights transfers={transfers} />
}
