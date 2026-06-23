export interface EventLikeForDisplay {
  tour?: { name: string } | null
  transferService?: { name: string } | null
}

export interface EventLikeForServiceId {
  tour?: { id: string } | null
  transferService?: { id: string } | null
}

export function getEventDisplayName(event: EventLikeForDisplay): string {
  return event.tour?.name ?? event.transferService?.name ?? "Sin servicio"
}

export function getEventServiceId(event: EventLikeForServiceId): string | null {
  return event.tour?.id ?? event.transferService?.id ?? null
}
