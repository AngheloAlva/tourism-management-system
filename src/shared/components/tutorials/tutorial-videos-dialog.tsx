"use client"

import { CirclePlay } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/shared/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/shared/components/ui/dialog"

interface TutorialVideo {
	title: string
	url: string
	description?: string
}

interface TutorialVideosDialogProps {
	buttonLabel?: string
	title?: string
	description?: string
	videos: TutorialVideo[]
}

const getEmbedUrl = (url: string): string => {
	if (url.includes("youtu.be/")) {
		const id = url.split("youtu.be/")[1]?.split("?")[0]
		return id ? `https://www.youtube.com/embed/${id}` : url
	}

	if (url.includes("youtube.com/watch")) {
		const parsed = new URL(url)
		const id = parsed.searchParams.get("v")
		return id ? `https://www.youtube.com/embed/${id}` : url
	}

	return url
}

export function TutorialVideosDialog({
	buttonLabel = "Ver tutoriales",
	title = "Tutoriales",
	description = "Selecciona un tutorial para verlo dentro del sistema.",
	videos,
}: TutorialVideosDialogProps) {
	const [selectedIndex, setSelectedIndex] = useState(0)

	const selectedVideo = videos[selectedIndex]
	const selectedEmbedUrl = useMemo(
		() => (selectedVideo ? getEmbedUrl(selectedVideo.url) : ""),
		[selectedVideo]
	)

	if (videos.length === 0) {
		return null
	}

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="outline" className="gap-2">
					<CirclePlay className="h-4 w-4" />
					{buttonLabel}
				</Button>
			</DialogTrigger>

			<DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto sm:max-w-[90vw]">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 sm:grid-cols-[260px_1fr] lg:grid-cols-[280px_1fr]">
					<div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
						{videos.map((video, index) => (
							<Button
								key={video.url}
								variant={index === selectedIndex ? "default" : "outline"}
								className="h-auto w-full justify-start text-left"
								onClick={() => setSelectedIndex(index)}
							>
								<div className="space-y-1 py-1">
									<p className="text-sm font-medium">{video.title}</p>
									{video.description ? (
										<p className="text-muted-foreground text-xs">{video.description}</p>
									) : null}
								</div>
							</Button>
						))}
					</div>

					<div className="min-w-0 space-y-3">
						<div className="bg-muted aspect-video min-h-[200px] overflow-hidden rounded-md border">
							<iframe
								src={selectedEmbedUrl}
								title={selectedVideo.title}
								className="h-full w-full"
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
								referrerPolicy="strict-origin-when-cross-origin"
								allowFullScreen
							/>
						</div>
						<a
							href={selectedVideo.url}
							target="_blank"
							rel="noreferrer"
							className="text-sm font-medium text-orange-600 underline underline-offset-4"
						>
							Abrir en YouTube
						</a>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
