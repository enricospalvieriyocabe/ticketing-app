import type { TicketConfigItem } from "@/lib/ticket-config";

export type CaseTypeOpenRules = {
  showInOpenForm: boolean;
  requiresOrderReference: boolean;
  requiresShippingInfo: boolean;
  requiresDeliveryInfo: boolean;
  requiresDocumentsNote: boolean;
};

const DEFAULT_OPEN_RULES: CaseTypeOpenRules = {
  showInOpenForm: false,
  requiresOrderReference: false,
  requiresShippingInfo: false,
  requiresDeliveryInfo: false,
  requiresDocumentsNote: false,
};

export function getCaseTypeOpenRules(item: TicketConfigItem): CaseTypeOpenRules {
  return {
    showInOpenForm: item.show_in_open_form ?? DEFAULT_OPEN_RULES.showInOpenForm,
    requiresOrderReference:
      item.requires_order_reference ?? DEFAULT_OPEN_RULES.requiresOrderReference,
    requiresShippingInfo:
      item.requires_shipping_info ?? DEFAULT_OPEN_RULES.requiresShippingInfo,
    requiresDeliveryInfo:
      item.requires_delivery_info ?? DEFAULT_OPEN_RULES.requiresDeliveryInfo,
    requiresDocumentsNote:
      item.requires_documents_note ?? DEFAULT_OPEN_RULES.requiresDocumentsNote,
  };
}

export function openingCaseTypes(items: TicketConfigItem[]): TicketConfigItem[] {
  return items
    .filter((item) => item.is_active && getCaseTypeOpenRules(item).showInOpenForm)
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "it"));
}

export function findOpeningCaseType(
  items: TicketConfigItem[],
  code?: string | null
): TicketConfigItem | null {
  if (!code) return null;
  const match = items.find((item) => item.code === code);
  if (!match || !getCaseTypeOpenRules(match).showInOpenForm) return null;
  return match;
}

export type OpenTicketFormValues = {
  caseType: string;
  orderReference: string;
  shippingInfo: string;
  deliveryInfo: string;
  documentsNote: string;
};

export function validateOpenTicketForm(
  caseTypes: TicketConfigItem[],
  values: OpenTicketFormValues
): string | null {
  const selected = findOpeningCaseType(caseTypes, values.caseType);
  if (!selected) {
    return "Seleziona una casistica di apertura";
  }

  const rules = getCaseTypeOpenRules(selected);

  if (rules.requiresOrderReference && !values.orderReference.trim()) {
    return "Inserisci il riferimento ordine (obbligatorio per questa casistica)";
  }
  if (rules.requiresShippingInfo && !values.shippingInfo.trim()) {
    return "Inserisci le informazioni di spedizione";
  }
  if (rules.requiresDeliveryInfo && !values.deliveryInfo.trim()) {
    return "Inserisci le informazioni di consegna";
  }
  if (rules.requiresDocumentsNote && !values.documentsNote.trim()) {
    return "Inserisci una nota sui documenti (caricamento file in arrivo)";
  }

  return null;
}
