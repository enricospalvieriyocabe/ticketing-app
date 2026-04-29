export function extractOrderReference(...inputs: Array<string | null | undefined>): string | null {
  const source = inputs
    .filter((value): value is string => Boolean(value))
    .join("\n");

  if (!source) return null;

  const patterns = [
    /inquiry\s+to\s+order\s*[:#-]?\s*(\d{6,})/i,
    /anfrage\s+zu\s+der\s+bestellung[\s/:-]*?(\d{6,})/i,
    /order(?:\s+number|\s+no|\s+n)?\s*[:#-]?\s*(\d{6,})/i,
    /bestellung\s*[:#-]?\s*(\d{6,})/i,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}
