type TicketInputChannel = "email" | "manual" | "unknown";

type ParsedTicketContent = {
  channel: TicketInputChannel;
  cleanTitle: string;
  summary: string;
  preview: string;
  rawBody: string;
  from: string | null;
  messageId: string | null;
  threadId: string | null;
  orderReference: string | null;
};

const STRUCTURED_HEADER_START = "[ticket-input]";
const STRUCTURED_HEADER_END = "[/ticket-input]";
const STRUCTURED_RAW_START = "[raw]";
const STRUCTURED_RAW_END = "[/raw]";

function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function removeForwardNoise(value: string): string {
  return value
    .replace(/^-{2,}\s*Forwarded message\s*-{2,}$/gim, "")
    .replace(/^From:\s.*$/gim, "")
    .replace(/^Da:\s.*$/gim, "")
    .replace(/^Date:\s.*$/gim, "")
    .replace(/^Subject:\s.*$/gim, "")
    .replace(/^To:\s.*$/gim, "")
    .replace(/^Cc:\s.*$/gim, "")
    .replace(/^A:\s.*$/gim, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function shortPreview(value: string, max = 140): string {
  const compact = toSingleLine(value);
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}...`;
}

function parseStructuredDescription(description: string) {
  const headerStart = description.indexOf(STRUCTURED_HEADER_START);
  const headerEnd = description.indexOf(STRUCTURED_HEADER_END);

  if (headerStart === -1 || headerEnd === -1 || headerEnd < headerStart) return null;

  const headerRaw = description
    .slice(headerStart + STRUCTURED_HEADER_START.length, headerEnd)
    .trim();
  const metadata: Record<string, string> = {};
  for (const line of headerRaw.split("\n")) {
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) metadata[key] = value;
  }

  const rawStart = description.indexOf(STRUCTURED_RAW_START);
  const rawEnd = description.indexOf(STRUCTURED_RAW_END);
  const summary = description.slice(headerEnd + STRUCTURED_HEADER_END.length, rawStart === -1 ? undefined : rawStart).trim();
  const rawBody =
    rawStart !== -1 && rawEnd !== -1 && rawEnd > rawStart
      ? description.slice(rawStart + STRUCTURED_RAW_START.length, rawEnd).trim()
      : summary;

  return { metadata, summary, rawBody };
}

function parseLegacyEmailDescription(description: string) {
  const marker = "\n\n---\n";
  const markerIdx = description.indexOf(marker);
  const mainBody = markerIdx >= 0 ? description.slice(0, markerIdx).trim() : description.trim();
  const tail = markerIdx >= 0 ? description.slice(markerIdx + marker.length).trim() : "";

  const fromMatch = tail.match(/Mittente:\s*(.+)/i);
  const messageMatch = tail.match(/Message-ID:\s*(.+)/i);

  return {
    summary: removeForwardNoise(mainBody),
    rawBody: mainBody,
    from: fromMatch ? fromMatch[1].trim() : null,
    messageId: messageMatch ? messageMatch[1].trim() : null,
  };
}

export function formatEmailDescription(input: {
  cleanBody: string;
  rawBody: string;
  from: string;
  messageId: string;
  threadId?: string | null;
  receivedAt?: string | null;
  orderReference?: string | null;
}) {
  return [
    STRUCTURED_HEADER_START,
    "channel=email",
    `from=${input.from}`,
    `message_id=${input.messageId}`,
    `thread_id=${input.threadId ?? ""}`,
    `received_at=${input.receivedAt ?? ""}`,
    `order_reference=${input.orderReference ?? ""}`,
    STRUCTURED_HEADER_END,
    "",
    input.cleanBody,
    "",
    STRUCTURED_RAW_START,
    input.rawBody,
    STRUCTURED_RAW_END,
  ].join("\n");
}

export function parseTicketContent(ticket: { title?: string | null; description?: string | null }): ParsedTicketContent {
  const rawTitle = (ticket.title ?? "").trim();
  const rawDescription = (ticket.description ?? "").trim();
  const fallbackSummary = shortPreview(rawDescription || "Nessun contenuto disponibile");
  const emailTitle = rawTitle.replace(/^\[Email\]\s*/i, "").trim();

  const structured = parseStructuredDescription(rawDescription);
  if (structured) {
    const channel = (structured.metadata.channel as TicketInputChannel) || "unknown";
    const summary = removeForwardNoise(structured.summary || structured.rawBody);
    return {
      channel,
      cleanTitle: emailTitle || rawTitle || "(senza oggetto)",
      summary: summary || fallbackSummary,
      preview: shortPreview(summary || fallbackSummary),
      rawBody: structured.rawBody || summary || "",
      from: structured.metadata.from || null,
      messageId: structured.metadata.message_id || null,
      threadId: structured.metadata.thread_id || null,
      orderReference: structured.metadata.order_reference || null,
    };
  }

  if (/^\[Email\]/i.test(rawTitle) || /Message-ID:/i.test(rawDescription)) {
    const legacy = parseLegacyEmailDescription(rawDescription);
    const summary = legacy.summary || fallbackSummary;
    return {
      channel: "email",
      cleanTitle: emailTitle || rawTitle || "(senza oggetto)",
      summary,
      preview: shortPreview(summary),
      rawBody: legacy.rawBody || summary,
      from: legacy.from,
      messageId: legacy.messageId,
      threadId: null,
      orderReference: null,
    };
  }

  const summary = removeForwardNoise(rawDescription) || fallbackSummary;
  return {
    channel: "manual",
    cleanTitle: rawTitle || "(senza titolo)",
    summary,
    preview: shortPreview(summary),
    rawBody: rawDescription,
    from: null,
    messageId: null,
    threadId: null,
    orderReference: null,
  };
}
