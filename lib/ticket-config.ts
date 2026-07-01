export type TicketConfigItem = {
  id: string;
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  ticket_count?: number;
  policy_count?: number;
  show_in_open_form?: boolean;
  requires_order_reference?: boolean;
  requires_shipping_info?: boolean;
  requires_delivery_info?: boolean;
  requires_documents_note?: boolean;
};

export const DEFAULT_TICKET_CATEGORIES: TicketConfigItem[] = [
  { id: "default-general", code: "general", label: "Generale", sort_order: 10, is_active: true },
  { id: "default-it", code: "it", label: "IT", sort_order: 20, is_active: true },
  { id: "default-hr", code: "hr", label: "HR", sort_order: 30, is_active: true },
  { id: "default-admin", code: "admin", label: "Amministrazione", sort_order: 40, is_active: true },
  { id: "default-bug", code: "bug", label: "Bug", sort_order: 50, is_active: true },
];

export const DEFAULT_CASE_TYPES: TicketConfigItem[] = [
  {
    id: "default-open-order",
    code: "ticket_su_ordine",
    label: "Ticket su ordine",
    sort_order: 5,
    is_active: true,
    show_in_open_form: true,
    requires_order_reference: true,
  },
  {
    id: "default-open-general",
    code: "ticket_generale",
    label: "Ticket generale",
    sort_order: 6,
    is_active: true,
    show_in_open_form: true,
  },
  {
    id: "default-open-replenishment",
    code: "ticket_rifornimento_magazzino",
    label: "Ticket rifornimento magazzino",
    sort_order: 7,
    is_active: true,
    show_in_open_form: true,
    requires_shipping_info: true,
    requires_delivery_info: true,
    requires_documents_note: true,
  },
  {
    id: "default-pnr",
    code: "pacco_non_ricevuto",
    label: "Pacco non ricevuto",
    sort_order: 10,
    is_active: true,
  },
  {
    id: "default-pnre",
    code: "pacco_non_consegnato_rimborso_emesso",
    label: "Pacco non consegnato, rimborso emesso da Zalando",
    sort_order: 20,
    is_active: true,
  },
  {
    id: "default-cso",
    code: "consegna_senza_ordine",
    label: "Consegna senza ordine",
    sort_order: 30,
    is_active: true,
  },
];

export function slugifyConfigCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function getCategoryLabel(
  categories: TicketConfigItem[],
  code?: string | null
): string {
  if (!code) return "—";
  const match = categories.find((item) => item.code === code);
  return match?.label ?? code;
}

export function getCaseTypeLabelFromConfig(
  caseTypes: TicketConfigItem[],
  code?: string | null
): string {
  if (!code) return "Non classificato";
  const match = caseTypes.find((item) => item.code === code);
  return match?.label ?? code;
}

export function activeConfigItems(items: TicketConfigItem[]): TicketConfigItem[] {
  return [...items]
    .filter((item) => item.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "it"));
}
