import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { inferZalandoClassification } from "@/lib/ticket-classification";
import { extractOrderReference } from "@/lib/order-reference";
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

function extractEmailAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const angleMatch = value.match(/<([^>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1].trim().toLowerCase();
  const plainMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return plainMatch?.[0]?.toLowerCase() ?? null;
}

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

function normalizeSubjectForThreadMatch(value: string): string {
  let subject = value.trim().toLowerCase();
  for (let i = 0; i < 6; i += 1) {
    const next = subject.replace(/^(re|r|fw|fwd)\s*:\s*/i, "").trim();
    if (next === subject) break;
    subject = next;
  }
  return subject.replace(/\s+/g, " ");
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
  const ignoredSenders = String(process.env.EMAIL_INGEST_IGNORE_FROM ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

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
  const senderEmail = extractEmailAddress(fromEmail) ?? fromEmail.trim().toLowerCase();
  const normalizedSubject = normalizeSubjectForThreadMatch(subject);

  if (ignoredSenders.length > 0 && ignoredSenders.includes(senderEmail)) {
    return Response.json({
      ok: true,
      ignored: true,
      reason: "ignored_sender",
    });
  }

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
  const orderReference = extractOrderReference(subject, description);
  const title = `[Email] ${subject}`;
  const cleanedDescription = cleanEmailBody(description) || "Email senza contenuto testuale.";
  const structuredDescription = formatEmailDescription({
    cleanBody: cleanedDescription,
    rawBody: description,
    from: titlePrefix,
    messageId,
    threadId,
    receivedAt,
    orderReference,
  });
  let ticketIdToUse: string | null = null;

  if (threadId) {
    const { data: existingThreadTicket, error: existingThreadTicketError } = await supabaseAdmin
      .from("email_ingest_log")
      .select("ticket_id")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingThreadTicketError) {
      return Response.json({ error: existingThreadTicketError.message }, { status: 500 });
    }

    ticketIdToUse = existingThreadTicket?.ticket_id ?? null;
  }

  if (!ticketIdToUse) {
    const twoWeeksAgoIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: fallbackLogs, error: fallbackLogsError } = await supabaseAdmin
      .from("email_ingest_log")
      .select("ticket_id, subject")
      .ilike("from_email", `%${senderEmail}%`)
      .gte("created_at", twoWeeksAgoIso)
      .order("created_at", { ascending: false })
      .limit(50);

    if (fallbackLogsError) {
      return Response.json({ error: fallbackLogsError.message }, { status: 500 });
    }

    const fallbackMatch = (fallbackLogs ?? []).find(
      (row) => normalizeSubjectForThreadMatch(String(row.subject ?? "")) === normalizedSubject
    );
    ticketIdToUse = fallbackMatch?.ticket_id ?? null;
  }

  if (ticketIdToUse) {
    const inboundCommentBody = [
      `📩 Nuova email ricevuta da ${titlePrefix}`,
      `Subject: ${subject}`,
      `Message-ID: ${messageId}`,
      cleanedDescription,
    ].join("\n\n");

    const { error: commentError } = await supabaseAdmin.from("ticket_comments").insert({
      ticket_id: ticketIdToUse,
      user_id: systemUserId,
      body: inboundCommentBody,
    });

    if (commentError) {
      return Response.json({ error: commentError.message }, { status: 500 });
    }

    const { error: eventError } = await supabaseAdmin.from("ticket_events").insert({
      ticket_id: ticketIdToUse,
      user_id: systemUserId,
      type: "inbound_email",
      description: `Nuova email ricevuta (${threadId ? `thread ${threadId}` : "match subject+sender"}) (${messageId})`,
    });

    if (eventError) {
      return Response.json({ error: eventError.message }, { status: 500 });
    }

    const { error: logError } = await supabaseAdmin.from("email_ingest_log").insert({
      message_id: messageId,
      thread_id: threadId,
      ticket_id: ticketIdToUse,
      from_email: fromEmail,
      from_name: fromName,
      subject,
      received_at: receivedAt,
    });

    if (logError) {
      return Response.json({ error: logError.message }, { status: 500 });
    }

    return Response.json({ ok: true, duplicate: false, ticketId: ticketIdToUse, mergedIntoThread: true });
  }

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
      order_reference: orderReference,
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
