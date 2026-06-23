import { getSaleRecordById } from "@/project/sales/actions/sale-record.actions"
import { ConvertQuoteWrapper } from "@/project/sales/components/convert-quote-wrapper"
import { redirect } from "next/navigation"

interface ConvertQuotePageProps {
	params: Promise<{
		id: string
	}>
}

export default async function ConvertQuotePage({ params }: ConvertQuotePageProps) {
	const { id } = await params

	const quote = await getSaleRecordById(id)

	if (!quote) {
		redirect("/dashboard/navegacion-cotizaciones")
	}

	// Verificar que sea una cotización
	if (quote.type !== "QUOTE") {
		redirect("/dashboard/navegacion-cotizaciones")
	}

	// Verificar que no haya sido convertida ya
	if (quote.convertedToSale) {
		redirect("/dashboard/navegacion-cotizaciones")
	}

	return (
		<div className="container mx-auto py-6">
			<div className="mb-6">
				<h1 className="text-primary text-2xl font-bold">
					Convertir Cotización COT-{quote.voucher} a Venta
				</h1>
				<p className="text-muted-foreground mt-1">
					Complete los datos de pago para convertir esta cotización en una venta. La cotización
					original se mantendrá para referencia.
				</p>
			</div>

			<ConvertQuoteWrapper quote={quote} />
		</div>
	)
}
