import { parseTicketContent } from "@/lib/ticket-content";

function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/** Campi testuali usati dalla ricerca libera in dashboard. */
export function getTicketSearchHaystack(ticket: {
  title?: string | null;
  description?: string | null;
  order_reference?: string | null;
  shipping_info?: string | null;
  delivery_info?: string | null;
  documents_note?: string | null;
  case_type?: string | null;
}): string {
  const parsed = parseTicketContent(ticket);

  return [
    ticket.title,
    parsed.cleanTitle,
    parsed.summary,
    parsed.preview,
    parsed.rawBody,
    parsed.from,
    parsed.orderReference,
    ticket.order_reference,
    ticket.shipping_info,
    ticket.delivery_info,
    ticket.documents_note,
    ticket.case_type,
  ]
    .map(normalizeSearchText)
    .filter(Boolean)
    .join(" ");
}

export function ticketMatchesSearchQuery(
  ticket: Parameters<typeof getTicketSearchHaystack>[0],
  query: string
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const haystack = getTicketSearchHaystack(ticket);
  return haystack.includes(normalizedQuery);
}
