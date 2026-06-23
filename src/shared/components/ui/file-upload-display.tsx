"use client"

import { useState, useRef } from "react"
import { Button } from "./button"
import { Upload, X, File } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileUploadDisplayProps {
	label?: string
	accept?: string
	maxSize?: number
	onChange?: (file: File | null) => void
	className?: string
	disabled?: boolean
}

export function FileUploadDisplay({
	label = "Subir archivo",
	accept = "*",
	maxSize = 5,
	onChange,
	className,
	disabled = false,
}: FileUploadDisplayProps) {
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [isDragging, setIsDragging] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)

	const handleFileChange = (file: File | null) => {
		if (file && file.size > maxSize * 1024 * 1024) {
			alert(`El archivo es muy grande. Máximo ${maxSize}MB`)
			return
		}
		setSelectedFile(file)
		onChange?.(file)
	}

	const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault()
		setIsDragging(false)
		const file = e.dataTransfer.files[0]
		if (file) handleFileChange(file)
	}

	const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault()
		setIsDragging(true)
	}

	const handleDragLeave = () => {
		setIsDragging(false)
	}

	const handleClick = () => {
		if (!disabled) {
			inputRef.current?.click()
		}
	}

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0] || null
		if (file) handleFileChange(file)
	}

	const handleRemove = () => {
		setSelectedFile(null)
		onChange?.(null)
	}

	return (
		<div className={cn("space-y-2", className)}>
			<input
				ref={inputRef}
				type="file"
				accept={accept}
				onChange={handleInputChange}
				className="hidden"
				disabled={disabled}
			/>
			{!selectedFile ? (
				<div
					className={cn(
						"relative rounded-lg border-2 border-dashed p-6 transition-colors",
						disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
						isDragging && !disabled
							? "border-primary bg-primary/10"
							: "border-border bg-background hover:border-primary/50 hover:bg-primary/5"
					)}
					onDrop={disabled ? undefined : handleDrop}
					onDragOver={disabled ? undefined : handleDragOver}
					onDragLeave={disabled ? undefined : handleDragLeave}
					onClick={disabled ? undefined : handleClick}
				>
					<div className="flex flex-col items-center justify-center gap-2 text-center">
						<div className="bg-primary/10 rounded-full p-3">
							<Upload className="text-primary h-6 w-6" />
						</div>
						<div className="space-y-1">
							<p className="text-foreground text-sm font-medium">{label}</p>
							<p className="text-muted-foreground text-xs">
								Arrastra tu archivo aquí o haz click para seleccionar
							</p>
							<p className="text-muted-foreground text-xs">Máximo {maxSize}MB</p>
						</div>
					</div>
				</div>
			) : (
				<div className="bg-muted/50 flex items-center gap-3 rounded-lg border p-4">
					<div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
						<File className="text-primary h-5 w-5" />
					</div>
					<div className="flex-1 overflow-hidden">
						<p className="text-foreground truncate text-sm font-medium">{selectedFile.name}</p>
						<p className="text-muted-foreground text-xs">
							{(selectedFile.size / 1024).toFixed(1)} KB
						</p>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={handleRemove}
						className="h-8 w-8 shrink-0"
						disabled={disabled}
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			)}
		</div>
	)
}
