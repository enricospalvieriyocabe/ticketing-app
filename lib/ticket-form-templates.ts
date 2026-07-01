import type { TicketConfigItem } from "@/lib/ticket-config";

export const DEFAULT_FORM_TEMPLATE = "ticket_generale";

export type TicketFormTemplate = {
  code: string;
  label: string;
  requiresOrderReference: boolean;
  requiresShippingInfo: boolean;
  requiresDeliveryInfo: boolean;
  requiresDocumentsNote: boolean;
};

export const TICKET_FORM_TEMPLATES: TicketFormTemplate[] = [
  {
    code: "ticket_generale",
    label: "Ticket generale",
    requiresOrderReference: false,
    requiresShippingInfo: false,
    requiresDeliveryInfo: false,
    requiresDocumentsNote: false,
  },
  {
    code: "ticket_su_ordine",
    label: "Ticket su ordine",
    requiresOrderReference: true,
    requiresShippingInfo: false,
    requiresDeliveryInfo: false,
    requiresDocumentsNote: false,
  },
  {
    code: "ticket_rifornimento_magazzino",
    label: "Ticket rifornimento magazzino",
    requiresOrderReference: false,
    requiresShippingInfo: true,
    requiresDeliveryInfo: true,
    requiresDocumentsNote: true,
  },
];

export function getFormTemplate(code?: string | null): TicketFormTemplate {
  const match = TICKET_FORM_TEMPLATES.find((item) => item.code === code);
  return match ?? TICKET_FORM_TEMPLATES[0];
}

export function getCategoryFormTemplate(category?: TicketConfigItem | null): TicketFormTemplate {
  return getFormTemplate(category?.form_template ?? DEFAULT_FORM_TEMPLATE);
}

export function findCategoryByCode(
  categories: TicketConfigItem[],
  code?: string | null
): TicketConfigItem | null {
  if (!code) return null;
  return categories.find((item) => item.code === code) ?? null;
}

export type CategoryTicketFormValues = {
  category: string;
  orderReference: string;
  shippingInfo: string;
  deliveryInfo: string;
  documentsNote: string;
};

export function validateCategoryTicketForm(
  categories: TicketConfigItem[],
  values: CategoryTicketFormValues
): string | null {
  const selected = findCategoryByCode(categories, values.category);
  if (!selected) {
    return "Seleziona una categoria";
  }

  const rules = getCategoryFormTemplate(selected);

  if (rules.requiresOrderReference && !values.orderReference.trim()) {
    return "Popola il campo Riferimento ordine per aprire il ticket";
  }
  if (rules.requiresShippingInfo && !values.shippingInfo.trim()) {
    return "Popola il campo Informazioni spedizione per aprire il ticket";
  }
  if (rules.requiresDeliveryInfo && !values.deliveryInfo.trim()) {
    return "Popola il campo Informazioni consegna per aprire il ticket";
  }
  if (rules.requiresDocumentsNote && !values.documentsNote.trim()) {
    return "Popola il campo Documenti / allegati per aprire il ticket";
  }

  return null;
}
