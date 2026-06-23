"use client"

import dynamic from "next/dynamic"
import { useMemo, useRef, useState, useCallback, useTransition } from "react"
import { es } from "date-fns/locale"
import { format } from "date-fns"
import { toast } from "sonner"
import {
	ColumnDef,
	flexRender,
	useReactTable,
	getCoreRowModel,
	RowSelectionState,
} from "@tanstack/react-table"
import {
	XIcon,
	CheckIcon,
	FileTextIcon,
	CalendarIcon,
	ClockFadingIcon,
	CircleCheckIcon,
	CheckCircle2Icon,
	ChevronsUpDownIcon,
} from "lucide-react"

import { batchUpdatePaymentStatus } from "../../actions/update-payment-status"
import { cn } from "@/lib/utils"
import { clp, sum, calculateBalance } from "./types"

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import { FileUpload } from "@/shared/components/file-upload"
const MonthlyHistoryChart = dynamic(
	() =>
		import("./MonthlyHistoryChart").then((m) => ({
			default: m.MonthlyHistoryChart,
		})),
	{ ssr: false }
)
import { Checkbox } from "@/shared/components/ui/checkbox"
import { Calendar } from "@/shared/components/ui/calendar"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { Button } from "@/shared/components/ui/button"
import { Label } from "@/shared/components/ui/label"
import { BalanceCards } from "./BalanceCards"
import {
	Command,
	CommandItem,
	CommandList,
	CommandEmpty,
	CommandGroup,
	CommandInput,
} from "@/shared/components/ui/command"
import {
	Table,
	TableRow,
	TableBody,
	TableCell,
	TableHead,
	TableFooter,
	TableHeader,
	TableCaption,
} from "@/shared/components/ui/table"
import {
	Dialog,
	DialogTitle,
	DialogFooter,
	DialogHeader,
	DialogContent,
	DialogDescription,
} from "@/shared/components/ui/dialog"
import {
	Select,
	SelectItem,
	SelectValue,
	SelectContent,
	SelectTrigger,
} from "@/shared/components/ui/select"

import type { CGData, CGParams, CGRow, Estado } from "./types"
import type { ReactNode } from "react"

type Agency = {
	id: string
	name: string
}

type ManagementCloseViewProps = {
	agencies: Agency[]
	initialAgencyId?: string
	data?: CGData
	fetcher?: (filters: CGParams) => Promise<CGData>
}

export function ManagementCloseView({
	agencies,
	initialAgencyId,
	data: defaultPendingData,
	fetcher,
}: ManagementCloseViewProps) {
	const [pendingData, setPendingData] = useState<CGData | null>(defaultPendingData ?? null)
	const [agencyId, setAgencyId] = useState(initialAgencyId ?? agencies[0]?.id ?? "")
	const [agencyOpen, setAgencyOpen] = useState(false)
	const [from, setFrom] = useState<Date | undefined>(undefined)
	const [to, setTo] = useState<Date | undefined>(undefined)

	const [historyData, setHistoryData] = useState<CGData | null>(null)
	const [isHistoryLoading, setIsHistoryLoading] = useState(false)
	const [hasLoadedHistory, setHasLoadedHistory] = useState(false)
	const [hasSearched, setHasSearched] = useState(false)

	const [isPending, startTransition] = useTransition()
	const [reportGeneratedAt, setReportGeneratedAt] = useState<Date | null>(null)

	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [selectedRows, setSelectedRows] = useState<CGRow[]>([])
	const [newStatus, setNewStatus] = useState<Estado>("FULLY_PAID")
	const [proofUrl, setProofUrl] = useState<string>("")
	const [isSubmitting, setIsSubmitting] = useState(false)

	const selectedAgencyName = useMemo(
		() => agencies.find((agency) => agency.id === agencyId)?.name ?? "",
		[agencies, agencyId]
	)

	const applyFilters = useCallback(() => {
		startTransition(async () => {
			const filters: CGParams = {
				agencyId,
				from: from ? new Date(from) : undefined,
				to: to ? new Date(to) : undefined,
				includePaid: false,
			}

			if (fetcher) {
				const remotePending = await fetcher(filters)
				setPendingData(remotePending)

				setHistoryData(null)
				setHasLoadedHistory(false)
				setHasSearched(true)
				setReportGeneratedAt(new Date())
				return
			}
		})
	}, [agencyId, fetcher, from, to])

	const handleLoadHistory = useCallback(async () => {
		if (hasLoadedHistory || !fetcher) return

		setIsHistoryLoading(true)
		try {
			const filters: CGParams = {
				agencyId,
				from: from ? new Date(from) : undefined,
				to: to ? new Date(to) : undefined,
				includePaid: true,
			}
			const remoteData = await fetcher(filters)

			const paidRecepciones = remoteData.recepciones.filter((r) => r.estado === "FULLY_PAID")
			const paidTraspasos = remoteData.traspasos.filter((r) => r.estado === "FULLY_PAID")

			setHistoryData({ recepciones: paidRecepciones, traspasos: paidTraspasos })
			setHasLoadedHistory(true)
		} catch (error) {
			console.error("Error loading history:", error)
			toast.error("No se pudo cargar el historial")
		} finally {
			setIsHistoryLoading(false)
		}
	}, [agencyId, fetcher, from, to, hasLoadedHistory])

	const { receivables, payables, balance } = useMemo(() => {
		if (!pendingData) return { receivables: 0, payables: 0, balance: 0 }

		const pendingRecepciones = pendingData.recepciones.filter((r) => r.estado !== "FULLY_PAID")
		const pendingTraspasos = pendingData.traspasos.filter((r) => r.estado !== "FULLY_PAID")

		const receivables = sum(pendingTraspasos.map(calculateBalance))
		const payables = sum(pendingRecepciones.map(calculateBalance))

		return {
			receivables,
			payables,
			balance: receivables - payables,
		}
	}, [pendingData])

	const printRef = useRef<HTMLDivElement | null>(null)

	const handlePrint = useCallback(() => {
		if (typeof window !== "undefined") {
			window.print()
		}
	}, [])

	const handleAgencySelect = useCallback(
		(value: string) => {
			const nextValue = value === agencyId ? "" : value
			setAgencyId(nextValue)
			setAgencyOpen(false)
		},
		[agencyId]
	)

	const handleClearFilters = useCallback(() => {
		setAgencyId("")
		setFrom(undefined)
		setTo(undefined)
		setPendingData(defaultPendingData ?? null)
		setHistoryData(null)
		setHistoryData(null)
		setHasLoadedHistory(false)
		setHasSearched(false)
		setReportGeneratedAt(null)
	}, [defaultPendingData])

	const openUpdateDialog = (rows: CGRow[], defaultStatus?: Estado) => {
		setSelectedRows(rows)
		setNewStatus(defaultStatus || "FULLY_PAID")
		setProofUrl("")
		setIsDialogOpen(true)
	}

	const handleStatusChangeSubmit = async () => {
		if (selectedRows.length === 0) return

		setIsSubmitting(true)
		try {
			const receptionVouchers = selectedRows
				.filter((r) => r.type === "RECEPTION")
				.map((r) => Number(r.voucher))

			const transferVouchers = selectedRows
				.filter((r) => r.type === "TRANSFER")
				.map((r) => Number(r.voucher))

			const promises = []

			if (receptionVouchers.length > 0) {
				promises.push(
					batchUpdatePaymentStatus({
						type: "RECEPTION",
						vouchers: receptionVouchers,
						status: newStatus,
						proofOfPayment: proofUrl || undefined,
					})
				)
			}

			if (transferVouchers.length > 0) {
				promises.push(
					batchUpdatePaymentStatus({
						type: "TRANSFER",
						vouchers: transferVouchers,
						status: newStatus,
						proofOfPayment: proofUrl || undefined,
					})
				)
			}

			const settled = await Promise.allSettled(promises)
			const fulfilled = settled.filter((r) => r.status === "fulfilled").map((r) => r.value)
			const rejected = settled.filter((r) => r.status === "rejected")
			const allSuccess = rejected.length === 0 && fulfilled.every((r) => r.success)

			if (allSuccess) {
				toast.success("Estados actualizados correctamente")

				if (pendingData) {
					const isPaid = newStatus === "FULLY_PAID"

					const updateList = (list: CGRow[]) =>
						list
							.map((r) => {
								const isSelected = selectedRows.some(
									(sel) => sel.voucher === r.voucher && sel.type === r.type
								)
								if (isSelected) {
									return { ...r, estado: newStatus, proofOfPayment: proofUrl || r.proofOfPayment }
								}
								return r
							})
							.filter((r) => !isPaid || r.estado !== "FULLY_PAID")

					setPendingData({
						recepciones: updateList(pendingData.recepciones),
						traspasos: updateList(pendingData.traspasos),
					})
				}

				if (hasLoadedHistory) {
					setHasLoadedHistory(false)
					setHistoryData(null)
				}

				setIsDialogOpen(false)
			} else {
				const failedCount = rejected.length + fulfilled.filter((r) => !r.success).length
				toast.error(`Hubo un error al actualizar ${failedCount} operación(es)`)
			}
		} catch (error) {
			console.error("Error updating statuses:", error)
			toast.error("Error al actualizar estados")
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleFileRemove = () => {
		setProofUrl("")
	}

	const pendingColumns = useMemo<ColumnDef<CGRow>[]>(
		() => [
			{
				id: "select",
				header: ({ table }) => (
					<Checkbox
						checked={table.getIsAllPageRowsSelected()}
						onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
						aria-label="Select all"
						className="translate-y-[2px]"
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => row.toggleSelected(!!value)}
						aria-label="Select row"
						className="translate-y-[2px]"
					/>
				),
				enableSorting: false,
				enableHiding: false,
			},
			...operationsColumns.filter((col) => {
				const key = (col as any).accessorKey
				return key !== "total" && key !== "estado"
			}),
			{
				id: "saldo",
				header: "Saldo",
				cell: ({ row }) => {
					const color = row.original.type === "RECEPTION" ? "text-amber-600" : "text-emerald-600"
					return (
						<div className={cn("font-semibold", color)}>{clp(calculateBalance(row.original))}</div>
					)
				},
			},
			{
				accessorKey: "estado",
				header: "Estado",
				cell: ({ row }) => {
					const estado = row.getValue("estado") as Estado
					const mapLabel = (e: Estado) => {
						switch (e) {
							case "FULLY_PAID":
								return "pagado"
							case "PENDING":
								return "pendiente"
							case "ENTRANCE_ONLY":
								return "solo entrada"
							case "TOUR_ONLY":
								return "solo tour"
							default:
								return e
						}
					}
					return (
						<div className="min-w-[120px]">
							<span
								className={cn(
									"inline-flex items-center rounded px-2 py-0.5 text-xs whitespace-nowrap",
									estado === "FULLY_PAID"
										? "bg-emerald-100 text-emerald-700"
										: "bg-amber-100 text-amber-700"
								)}
							>
								{mapLabel(estado)}
							</span>
						</div>
					)
				},
			},
			{
				id: "actions",
				header: "Acciones",
				cell: ({ row }) => (
					<div className="print:hidden">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => openUpdateDialog([row.original], row.original.estado)}
							className="h-8 w-8 p-0"
							title="Cambiar estado"
						>
							<CheckCircle2Icon className="h-4 w-4 text-amber-600" />
						</Button>
					</div>
				),
			},
		],
		[]
	)

	const historyColumns = useMemo<ColumnDef<CGRow>[]>(
		() => [
			{
				id: "select",
				header: ({ table }) => (
					<Checkbox
						checked={table.getIsAllPageRowsSelected()}
						onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
						aria-label="Select all"
						className="translate-y-[2px]"
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => row.toggleSelected(!!value)}
						aria-label="Select row"
						className="translate-y-[2px]"
					/>
				),
				enableSorting: false,
				enableHiding: false,
			},
			...operationsColumns,
			{
				id: "proof",
				header: "Comprobante",
				cell: ({ row }) => {
					const proof = row.original.proofOfPayment
					if (!proof) return null
					return (
						<a
							href={proof}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
						>
							<FileTextIcon className="h-3 w-3" /> Ver
						</a>
					)
				},
			},
			{
				id: "actions",
				header: "Acciones",
				cell: ({ row }) => (
					<div className="print:hidden">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => openUpdateDialog([row.original], "FULLY_PAID")}
							className="h-8 w-8 p-0"
							title="Cambiar estado"
						>
							<CheckCircle2Icon className="h-4 w-4 text-emerald-600" />
						</Button>
					</div>
				),
			},
		],
		[]
	)

	return (
		<div className="space-y-8">
			<div className="grid items-end gap-3 md:grid-cols-4">
				<div className="pl-0">
					<label className="pl-1 text-sm font-medium">Agencia</label>
					<Popover open={agencyOpen} onOpenChange={setAgencyOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								role="combobox"
								aria-expanded={agencyOpen}
								className="w-full justify-between"
							>
								{agencyId ? selectedAgencyName : "Selecciona agencia..."}
								<ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-full p-0">
							<Command>
								<CommandInput placeholder="Buscar agencia..." className="h-9" />
								<CommandList>
									<CommandEmpty>No se encontró la agencia.</CommandEmpty>
									<CommandGroup>
										{agencies.map((agency) => (
											<CommandItem
												key={agency.id}
												value={`${agency.name} ${agency.id}`}
												onSelect={() => handleAgencySelect(agency.id)}
											>
												{agency.name}
												<CheckIcon
													className={cn(
														"ml-auto h-4 w-4",
														agencyId === agency.id ? "opacity-100" : "opacity-0"
													)}
												/>
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
				</div>
				<div>
					<label className="pl-1 text-sm font-medium">Desde</label>
					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								className={cn(
									"w-full pl-3 text-left font-normal",
									!from && "text-muted-foreground"
								)}
							>
								{from ? format(from, "PPP", { locale: es }) : <span>dd/mm/aaaa</span>}
								<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="start">
							<Calendar
								mode="single"
								selected={from}
								onSelect={setFrom}
								initialFocus
								locale={es}
								captionLayout="dropdown"
							/>
						</PopoverContent>
					</Popover>
				</div>
				<div>
					<label className="pl-1 text-sm font-medium">Hasta</label>
					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								className={cn("w-full pl-3 text-left font-normal", !to && "text-muted-foreground")}
							>
								{to ? format(to, "PPP", { locale: es }) : <span>dd/mm/aaaa</span>}
								<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="start">
							<Calendar
								mode="single"
								selected={to}
								onSelect={setTo}
								initialFocus
								locale={es}
								captionLayout="dropdown"
							/>
						</PopoverContent>
					</Popover>
				</div>
				<div className="flex items-end justify-end gap-2">
					<Button variant="outline" onClick={handleClearFilters} disabled={isPending}>
						Limpiar
					</Button>

					<Button onClick={applyFilters} disabled={isPending}>
						{isPending ? "Cargando..." : "Aplicar"}
					</Button>
				</div>
			</div>

			{hasSearched && reportGeneratedAt && (
				<div className="bg-muted/30 border-border rounded-lg border px-4 py-3">
					<p className="text-sm">
						<span className="font-semibold">Reporte de:</span>{" "}
						{selectedAgencyName || "Todas las agencias"} del periodo de{" "}
						{from ? format(from, "dd/MM/yyyy", { locale: es }) : "inicio"} hasta el{" "}
						{to ? format(to, "dd/MM/yyyy", { locale: es }) : "hoy"}
					</p>
					<p className="text-muted-foreground mt-1 text-xs">
						Generado el {format(reportGeneratedAt, "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
					</p>
				</div>
			)}

			{!hasSearched && !isPending && (
				<div className="text-muted-foreground flex h-64 items-center justify-center rounded-lg border border-dashed">
					Selecciona una agencia y rango de fechas, luego haz clic en &quot;Aplicar&quot;
				</div>
			)}

			{hasSearched && (
				<>
					{isPending ? (
						<div className="space-y-6">
							<Skeleton className="h-[400px] w-full rounded-xl" />
							<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
								<Skeleton className="col-span-4 h-[200px] rounded-xl lg:col-span-4" />
								<Skeleton className="col-span-4 h-[200px] rounded-xl lg:col-span-3" />
							</div>
						</div>
					) : (
						<div className="space-y-8">
							<div id="cg-print" ref={printRef}>
								<Tabs defaultValue="pending" className="w-full">
									<div className="mb-4 flex w-full items-center justify-between gap-4">
										<TabsList className="w-full">
											<TabsTrigger value="pending">
												<ClockFadingIcon />
												Pendientes / Parciales
											</TabsTrigger>
											<TabsTrigger value="history" onClick={handleLoadHistory}>
												<CircleCheckIcon />
												Historial Pagado
											</TabsTrigger>
										</TabsList>
										<div className="flex justify-end gap-2 print:hidden">
											<Button onClick={handlePrint} variant="outline">
												Descargar PDF Vista Actual
											</Button>
										</div>
									</div>

									<TabsContent value="pending" className="space-y-6">
										{pendingData && (
											<>
												<Section>
													<div className="grid gap-6 md:grid-cols-2">
														<Block title="RECIBIDOS (Por Pagar)">
															<CGTable<CGRow>
																rows={pendingData.recepciones.filter(
																	(r) => r.estado !== "FULLY_PAID"
																)}
																footer={renderOperationsFooter}
																columns={pendingColumns}
																onBulkAction={openUpdateDialog}
															/>
														</Block>
														<Block title="TRASPASADOS (Por Cobrar)">
															<CGTable<CGRow>
																rows={pendingData.traspasos.filter(
																	(r) => r.estado !== "FULLY_PAID"
																)}
																footer={renderOperationsFooter}
																columns={pendingColumns}
																onBulkAction={openUpdateDialog}
															/>
														</Block>
													</div>
												</Section>

												<BalanceCards
													receivables={receivables}
													payables={payables}
													balance={balance}
												/>
											</>
										)}
									</TabsContent>

									<TabsContent value="history" className="space-y-6">
										{isHistoryLoading ? (
											<div className="space-y-6">
												<Skeleton className="h-[300px] w-full rounded-xl" />
												<Skeleton className="h-[300px] w-full rounded-xl" />
											</div>
										) : !hasLoadedHistory && !historyData ? (
											<div className="text-muted-foreground py-8 text-center">
												Haz clic en la pestaña para cargar el historial.
											</div>
										) : (
											historyData && (
												<>
													<Section>
														<div className="grid gap-6 md:grid-cols-2">
															<Block title="RECIBIDOS (Pagados)">
																<CGTable<CGRow>
																	rows={historyData.recepciones}
																	footer={renderHistoryFooter}
																	columns={historyColumns}
																	onBulkAction={openUpdateDialog}
																/>
															</Block>
															<Block title="TRASPASADOS (Cobrados)">
																<CGTable<CGRow>
																	rows={historyData.traspasos}
																	footer={renderHistoryFooter}
																	columns={historyColumns}
																	onBulkAction={openUpdateDialog}
																/>
															</Block>
														</div>
													</Section>
													<MonthlyHistoryChart
														recepciones={historyData.recepciones}
														traspasos={historyData.traspasos}
													/>
												</>
											)
										)}
									</TabsContent>
								</Tabs>
							</div>
						</div>
					)}
				</>
			)}

			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Actualizar Estado de Pago</DialogTitle>
						<DialogDescription>
							Estás actualizando {selectedRows.length} registro(s).
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="status">Estado</Label>
							<Select value={newStatus} onValueChange={(v) => setNewStatus(v as Estado)}>
								<SelectTrigger className="w-full" id="status">
									<SelectValue placeholder="Selecciona estado" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="PENDING">Pendiente</SelectItem>
									<SelectItem value="ENTRANCE_ONLY">Pago Solo Entrada</SelectItem>
									<SelectItem value="TOUR_ONLY">Pago Solo Tour</SelectItem>
									<SelectItem value="FULLY_PAID">Pagado Totalmente</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="grid gap-2">
							<Label>Comprobante de Pago (Opcional)</Label>
							{proofUrl ? (
								<div className="flex items-center gap-2 rounded-md border p-2">
									<FileTextIcon className="h-4 w-4 text-blue-500" />
									<span className="flex-1 truncate text-sm">Comprobante subido</span>
									<Button
										size="icon"
										variant="ghost"
										className="h-6 w-6"
										onClick={handleFileRemove}
									>
										<XIcon className="h-3 w-3" />
									</Button>
								</div>
							) : (
								<FileUpload
									className="w-full"
									onUploadComplete={setProofUrl}
									endpoint="/api/transfers/upload-proof"
								/>
							)}
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsDialogOpen(false)}
							disabled={isSubmitting}
						>
							Cancelar
						</Button>
						<Button onClick={handleStatusChangeSubmit} disabled={isSubmitting}>
							{isSubmitting ? "Guardando..." : "Guardar Cambios"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

function Section({ children }: { children: ReactNode }) {
	return <section className="space-y-6">{children}</section>
}

function Block({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div>
			<div className="text-muted-foreground mb-2 text-sm font-medium tracking-wider uppercase">
				{title}
			</div>
			{children}
		</div>
	)
}

const operationsColumns: ColumnDef<CGRow>[] = [
	{
		accessorKey: "fecha",
		header: "Fecha",
		cell: ({ row }) => {
			return (
				<div className="font-medium">
					{new Date(row.getValue("fecha")).toLocaleDateString("es-CL")}
				</div>
			)
		},
	},
	{
		accessorKey: "voucher",
		header: "Voucher",
		cell: ({ row }) => {
			return <div>{row.getValue("voucher")}</div>
		},
	},
	{
		accessorKey: "pax",
		header: "Pax",
		cell: ({ row }) => {
			return <div>{row.getValue("pax")}</div>
		},
	},
	{
		accessorKey: "tour",
		header: "Tour",
		cell: ({ row }) => {
			return <div>{row.original.tour}</div>
		},
	},
	{
		accessorKey: "valor",
		header: "Valor",
		cell: ({ row }) => {
			return <div>{clp(row.getValue("valor"))}</div>
		},
	},
	{
		accessorKey: "entrada",
		header: "Entrada",
		cell: ({ row }) => {
			return <div>{clp(row.getValue("entrada"))}</div>
		},
	},
	{
		accessorKey: "total",
		header: "Saldo Total",
		cell: ({ row }) => {
			return <div className="font-semibold">{clp(row.getValue("total"))}</div>
		},
	},
	{
		accessorKey: "estado",
		header: "Estado",
		cell: ({ row }) => {
			const estado = row.getValue("estado") as Estado

			const mapLabel = (e: Estado) => {
				switch (e) {
					case "FULLY_PAID":
						return "pagado"
					case "PENDING":
						return "pendiente"
					case "ENTRANCE_ONLY":
						return "solo entrada"
					case "TOUR_ONLY":
						return "solo tour"
					default:
						return e
				}
			}

			return (
				<div className="min-w-[120px]">
					<span
						className={cn(
							"inline-flex items-center rounded px-2 py-0.5 text-xs whitespace-nowrap",
							estado === "FULLY_PAID"
								? "bg-emerald-100 text-emerald-700"
								: "bg-amber-100 text-amber-700"
						)}
					>
						{mapLabel(estado)}
					</span>
				</div>
			)
		},
	},
]

type CGTableProps<TData> = {
	rows: TData[]
	columns?: ColumnDef<TData>[]
	caption?: string
	footer?: ((rows: TData[]) => ReactNode) | ReactNode | null
	emptyMessage?: string
	getRowClassName?: (row: TData) => string | undefined
	onBulkAction?: (rows: CGRow[], status?: Estado) => void
}

function CGTable<TData>({
	rows,
	columns,
	caption,
	footer,
	emptyMessage = "Sin registros",
	getRowClassName,
	onBulkAction,
}: CGTableProps<TData>) {
	const resolvedColumns = columns ?? (operationsColumns as unknown as ColumnDef<TData>[])
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

	// eslint-disable-next-line react-hooks/incompatible-library
	const table = useReactTable<TData>({
		data: rows,
		columns: resolvedColumns,
		getCoreRowModel: getCoreRowModel(),
		onRowSelectionChange: setRowSelection,
		state: {
			rowSelection,
		},
	})

	const selectedCount = Object.keys(rowSelection).length

	const handleBulkAction = () => {
		const selectedRows = table.getFilteredSelectedRowModel().rows.map((row) => row.original)
		onBulkAction?.(selectedRows as CGRow[])
	}

	const footerNode = typeof footer === "function" ? footer(rows) : (footer ?? null)

	return (
		<div className="bg-card w-full space-y-2 overflow-hidden rounded-xl border shadow-sm">
			{onBulkAction && selectedCount > 0 && (
				<div className="bg-muted/50 flex items-center justify-between border-b px-4 py-2">
					<span className="text-sm font-medium">{selectedCount} seleccionados</span>
					<Button size="sm" onClick={handleBulkAction}>
						Actualizar seleccionados
					</Button>
				</div>
			)}

			<Table>
				{caption && (
					<TableCaption className="text-muted-foreground text-left text-sm">{caption}</TableCaption>
				)}
				<TableHeader>
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id} className="bg-muted/30">
							{headerGroup.headers.map((header) => {
								const columnMeta = header.column.columnDef.meta as
									| { align?: "right" | "center" }
									| undefined
								return (
									<TableHead
										key={header.id}
										className={cn(
											"text-muted-foreground text-xs tracking-wide uppercase",
											columnMeta?.align === "right" && "text-right",
											columnMeta?.align === "center" && "text-center"
										)}
									>
										{header.isPlaceholder
											? null
											: flexRender(header.column.columnDef.header, header.getContext())}
									</TableHead>
								)
							})}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows?.length ? (
						table.getRowModel().rows.map((row) => {
							const className = getRowClassName ? getRowClassName(row.original) : undefined
							return (
								<TableRow key={row.id} className={className}>
									{row.getVisibleCells().map((cell) => {
										const columnMeta = cell.column.columnDef.meta as
											| { align?: "right" | "center" }
											| undefined
										return (
											<TableCell
												key={cell.id}
												className={cn(
													"text-sm",
													columnMeta?.align === "right" && "text-right",
													columnMeta?.align === "center" && "text-center"
												)}
											>
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</TableCell>
										)
									})}
								</TableRow>
							)
						})
					) : (
						<TableRow>
							<TableCell
								colSpan={resolvedColumns.length}
								className="text-muted-foreground h-24 text-center"
							>
								{emptyMessage}
							</TableCell>
						</TableRow>
					)}
				</TableBody>
				{rows.length > 0 && footerNode && (
					<TableFooter className="bg-muted/40">{footerNode}</TableFooter>
				)}
			</Table>
		</div>
	)
}

const renderOperationsFooter = (rows: CGRow[]) => {
	if (!rows.length) return null
	const total = rows.reduce((sum, row) => calculateBalance(row) + sum, 0)

	return (
		<TableRow>
			<TableCell colSpan={7} className="text-muted-foreground px-4 py-2 text-right text-sm">
				Saldo Total
			</TableCell>
			<TableCell className="px-4 py-2 text-left text-base font-semibold">{clp(total)}</TableCell>
			<TableCell className="px-4 py-2" colSpan={3} />
		</TableRow>
	)
}

const renderHistoryFooter = (rows: CGRow[]) => {
	if (!rows.length) return null
	const total = rows.reduce((sum, row) => row.total + sum, 0)

	return (
		<TableRow>
			<TableCell colSpan={7} className="text-muted-foreground px-4 py-2 text-right text-sm">
				Total Histórico
			</TableCell>
			<TableCell className="px-4 py-2 text-left text-base font-semibold">{clp(total)}</TableCell>
			<TableCell className="px-4 py-2" colSpan={2} />
		</TableRow>
	)
}
