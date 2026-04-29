export const CASE_TYPE_OPTIONS = [
  { value: "pacco_non_ricevuto", label: "Pacco non ricevuto" },
  {
    value: "pacco_non_consegnato_rimborso_emesso",
    label: "Pacco non consegnato, rimborso emesso da Zalando",
  },
  {
    value: "consegna_senza_ordine",
    label: "Consegna senza ordine",
  },
] as const;

type CaseTypeValue = (typeof CASE_TYPE_OPTIONS)[number]["value"];

type ClassificationRule = {
  caseType: CaseTypeValue;
  tags?: string[];
  patterns: RegExp[];
};

export function getCaseTypeLabel(caseType?: string | null): string {
  const match = CASE_TYPE_OPTIONS.find((option) => option.value === caseType);
  return match?.label ?? "Non classificato";
}

function matchesAll(text: string, patterns: RegExp[]): boolean {
  return patterns.every((pattern) => pattern.test(text));
}

export function inferZalandoClassification(subject: string, body: string): {
  caseType: string | null;
  caseTags: string[];
} {
  const normalized = `${subject}\n${body}`.toLowerCase();

  const rules: ClassificationRule[] = [
    {
      caseType: "pacco_non_consegnato_rimborso_emesso",
      tags: ["zalando", "refund"],
      patterns: [
        /since the parcel was not damaged during transport/i,
        /issued a refund/i,
        /not necessary to reply to this e-mail/i,
      ],
    },
    {
      caseType: "consegna_senza_ordine",
      tags: ["zalando", "fraud_check"],
      patterns: [/received a parcel without placing an order/i],
    },
    {
      caseType: "pacco_non_ricevuto",
      tags: ["zalando", "investigation"],
      patterns: [
        /(has not received the parcel|nicht erhalten)/i,
        /(start an investigation|tracking link|not shipped yet|bestellung)/i,
      ],
    },
    {
      caseType: "pacco_non_ricevuto",
      tags: ["zalando"],
      patterns: [/(inquiry to order|anfrage zu der bestellung)/i],
    },
  ];

  for (const rule of rules) {
    if (matchesAll(normalized, rule.patterns)) {
      return {
        caseType: rule.caseType,
        caseTags: rule.tags ?? [],
      };
    }
  }

  return { caseType: null, caseTags: [] };
}
