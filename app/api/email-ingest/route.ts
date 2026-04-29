import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { inferZalandoClassification } from "@/lib/ticket-classification";
import { formatEmailDescription } from "@/lib/ticket-content";

type EmailIngestPayload = {
  messageId?: string;
  threadId?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  subject?: string | null;
  textBody?: string | null;
  htmlBody?: string | null;
  receivedAt?: string | null;
};

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanEmailBody(value: string): string {
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

function getAuthToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return req.headers.get("x-ingest-token");
}

export async function POST(req: Request) {
  const expectedToken = process.env.EMAIL_INGEST_TOKEN;
  const systemUserId = process.env.EMAIL_INGEST_SYSTEM_USER_ID;
  const defaultCategory = process.env.EMAIL_INGEST_DEFAULT_CATEGORY ?? "general";
  const defaultPriority = process.env.EMAIL_INGEST_DEFAULT_PRIORITY ?? "medium";

  if (!expectedToken || !systemUserId) {
    return Response.json(
      {
        error:
          "Missing EMAIL_INGEST_TOKEN or EMAIL_INGEST_SYSTEM_USER_ID environment variables.",
      },
      { status: 500 }
    );
  }

  const providedToken = getAuthToken(req);
  if (!providedToken || providedToken !== expectedToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabaseAdmin = getSupabaseAdmin();

  let payload: EmailIngestPayload;
  try {
    payload = (await req.json()) as EmailIngestPayload;
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const messageId = normalizeText(payload.messageId);
  if (!messageId) {
    return Response.json({ error: "messageId is required" }, { status: 400 });
  }

  const subject = normalizeText(payload.subject) ?? "(senza oggetto)";
  const textBody = normalizeText(payload.textBody);
  const htmlBody = normalizeText(payload.htmlBody);
  const description =
    textBody ?? (htmlBody ? stripHtml(htmlBody) : null) ?? "Email senza contenuto testuale.";

  const fromEmail = normalizeText(payload.fromEmail) ?? "unknown@unknown.local";
  const fromName = normalizeText(payload.fromName);
  const threadId = normalizeText(payload.threadId);
  const receivedAt = normalizeText(payload.receivedAt);

  const { data: existingLog, error: existingLogError } = await supabaseAdmin
    .from("email_ingest_log")
    .select("id, ticket_id")
    .eq("message_id", messageId)
    .maybeSingle();

  if (existingLogError) {
    return Response.json({ error: existingLogError.message }, { status: 500 });
  }

  if (existingLog) {
    return Response.json({
      ok: true,
      duplicate: true,
      ticketId: existingLog.ticket_id,
    });
  }

  const titlePrefix = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  const classification = inferZalandoClassification(subject, description);
  const title = `[Email] ${subject}`;
  const cleanedDescription = cleanEmailBody(description) || "Email senza contenuto testuale.";
  const structuredDescription = formatEmailDescription({
    cleanBody: cleanedDescription,
    rawBody: description,
    from: titlePrefix,
    messageId,
    threadId,
    receivedAt,
  });

  const { data: createdTicket, error: ticketError } = await supabaseAdmin
    .from("tickets")
    .insert({
      title,
      description: structuredDescription,
      category: defaultCategory,
      priority: defaultPriority,
      case_type: classification.caseType,
      case_tags: classification.caseTags,
      source_channel: "email",
      status: "open",
      created_by: systemUserId,
      requester_id: systemUserId,
    })
    .select("id")
    .single();

  if (ticketError || !createdTicket?.id) {
    return Response.json({ error: ticketError?.message ?? "Cannot create ticket" }, { status: 500 });
  }

  const { error: eventError } = await supabaseAdmin.from("ticket_events").insert({
    ticket_id: createdTicket.id,
    user_id: systemUserId,
    type: "email_ingest",
    description: `Ticket creato da email ${messageId}`,
  });

  if (eventError) {
    return Response.json({ error: eventError.message }, { status: 500 });
  }

  const { error: logError } = await supabaseAdmin.from("email_ingest_log").insert({
    message_id: messageId,
    thread_id: threadId,
    ticket_id: createdTicket.id,
    from_email: fromEmail,
    from_name: fromName,
    subject,
    received_at: receivedAt,
  });

  if (logError) {
    return Response.json({ error: logError.message }, { status: 500 });
  }

  return Response.json({ ok: true, duplicate: false, ticketId: createdTicket.id });
}
