"use client"

import { UploadCloud, X, FileIcon, Loader2 } from "lucide-react"
import { useState, useRef } from "react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

import { Button } from "@/shared/components/ui/button"

interface FileUploadProps {
	value?: string
	onUploadComplete: (url: string) => void
	onRemove?: () => void
	disabled?: boolean
	className?: string
	endpoint?: string
	language?: "es" | "en" | "pt"
}

export function FileUpload({
	value,
	onUploadComplete,
	onRemove,
	disabled = false,
	className,
	endpoint = "/api/tours/upload-pdf",
	language = "es",
}: FileUploadProps) {
	const [isUploading, setIsUploading] = useState(false)
	const [dragActive, setDragActive] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)

	const handleFile = async (file: File) => {
		if (!file) return

		// Validate file type (PDF or Images)
		if (!file.type.includes("pdf") && !file.type.includes("image")) {
			toast.error("Solo se permiten archivos PDF o imágenes")
			return
		}

		// Validate file size (max 5MB)
		if (file.size > 5 * 1024 * 1024) {
			toast.error("El archivo no puede pesar más de 5MB")
			return
		}

		setIsUploading(true)

		try {
			const response = await fetch(
				`${endpoint}?filename=${encodeURIComponent(file.name)}&language=${language}`,
				{
					method: "POST",
					body: file,
				}
			)

			if (!response.ok) {
				throw new Error("Error al subir el archivo")
			}

			const data = await response.json()
			onUploadComplete(data.url)
			toast.success("Archivo subido exitosamente")
		} catch (error) {
			console.error("Upload error:", error)
			toast.error("Error al subir el archivo")
		} finally {
			setIsUploading(false)
		}
	}

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		e.preventDefault()
		if (e.target.files && e.target.files[0]) {
			handleFile(e.target.files[0])
		}
	}

	const handleDrag = (e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		if (e.type === "dragenter" || e.type === "dragover") {
			setDragActive(true)
		} else if (e.type === "dragleave") {
			setDragActive(false)
		}
	}

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setDragActive(false)
		if (e.dataTransfer.files && e.dataTransfer.files[0]) {
			handleFile(e.dataTransfer.files[0])
		}
	}

	const handleRemove = () => {
		if (onRemove) {
			onRemove()
		}
		if (inputRef.current) {
			inputRef.current.value = ""
		}
	}

	return (
		<div className={cn("w-full", className)}>
			{value ? (
				<div className="relative flex items-center gap-2 rounded-md border p-3">
					<div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
						<FileIcon className="text-primary h-5 w-5" />
					</div>
					<div className="flex-1 overflow-hidden">
						<p className="text-foreground truncate text-sm font-medium">Archivo subido</p>
						<a
							href={value}
							target="_blank"
							rel="noopener noreferrer"
							className="text-muted-foreground truncate text-xs hover:underline"
						>
							Ver archivo
						</a>
					</div>
					{!disabled && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="text-muted-foreground hover:text-destructive h-8 w-8"
							onClick={handleRemove}
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>
			) : (
				<div
					className={cn(
						"relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
						dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
						disabled && "cursor-not-allowed opacity-60"
					)}
					onDragEnter={handleDrag}
					onDragLeave={handleDrag}
					onDragOver={handleDrag}
					onDrop={handleDrop}
				>
					<input
						ref={inputRef}
						type="file"
						className="hidden"
						accept=".pdf,image/*"
						onChange={handleChange}
						disabled={disabled || isUploading}
					/>

					{isUploading ? (
						<div className="flex flex-col items-center gap-2">
							<Loader2 className="text-primary h-8 w-8 animate-spin" />
							<p className="text-muted-foreground text-sm">Subiendo archivo...</p>
						</div>
					) : (
						<div className="flex flex-col items-center gap-2 text-center">
							<div className="bg-background rounded-full p-2 shadow-sm">
								<UploadCloud className="text-muted-foreground h-6 w-6" />
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium">
									<button
										type="button"
										onClick={() => inputRef.current?.click()}
										className="text-primary hover:underline"
										disabled={disabled}
									>
										Haz clic para subir
									</button>{" "}
									o arrastra y suelta
								</p>
								<p className="text-muted-foreground text-xs">PDF o Imágenes (max. 5MB)</p>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}
