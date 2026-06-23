import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { Button } from "@/shared/components/ui/button"

import type { ReactNode } from "react"

interface ProvidersPageHeaderProps {
	title: string
	description: string
	action?: ReactNode
	backHref?: string
}

export function ProvidersPageHeader({
	title,
	description,
	action,
	backHref,
}: ProvidersPageHeaderProps) {
	return (
		<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div className="flex items-start gap-3">
				{backHref ? (
					<Button variant="ghost" size="icon" asChild>
						<Link href={backHref}>
							<ArrowLeft className="h-4 w-4" />
						</Link>
					</Button>
				) : null}
				<div>
					<h1 className="text-3xl font-bold tracking-tight">{title}</h1>
					<p className="text-muted-foreground mt-1">{description}</p>
				</div>
			</div>
			{action ? <div className="shrink-0">{action}</div> : null}
		</div>
	)
}
