"use client"

import { AgencyDataTable } from "@/project/agency/components/agency-data-table"

import type { ColumnDef } from "@tanstack/react-table"

interface DataTableProps<TData extends object, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
}

export function TransferAgencyDataTable<TData extends object, TValue>({
	columns,
	data,
}: DataTableProps<TData, TValue>) {
	return <AgencyDataTable columns={columns} data={data} />
}
