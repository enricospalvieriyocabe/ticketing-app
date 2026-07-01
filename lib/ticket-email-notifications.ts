import type { SupabaseClient } from "@supabase/supabase-js";

import { getAppUrl } from "@/lib/app-url";
import { formatTicketNumber } from "@/lib/ticket-number";

export type EmailTemplatePurpose =
  | "compose"
  | "off_hours"
  | "ticket_open"
  | "ticket_close"
  | "user_reply";

type TicketEmailContext = {
  ticketId: string;
  ticketNumber?: number | string | null;
  title?: string | null;
  replyBody?: string | null;
};

type RequesterProfile = {
  id: string;
  email?: string | null;
  role?: string | null;
};

function extractEmailAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const angleMatch = value.match(/<([^>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1].trim();
  const plainMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return plainMatch?.[0] ?? null;
}

export function applyEmailTemplateVars(
  template: string,
  context: TicketEmailContext
): string {
  const ticketLabel =
    formatTicketNumber(context.ticketNumber) || context.ticketId.slice(0, 8);
  const appUrl = getAppUrl();
  const ticketUrl = `${appUrl}/ticket/${context.ticketId}`;

  return template
    .replaceAll("{{ticket_number}}", ticketLabel)
    .replaceAll("{{title}}", String(context.title ?? "").trim())
    .replaceAll("{{reply_body}}", String(context.replyBody ?? "").trim())
    .replaceAll("{{app_url}}", appUrl)
    .replaceAll("{{ticket_url}}", ticketUrl);
}

export async function findEnabledEmailTemplate(
  admin: SupabaseClient,
  purpose: EmailTemplatePurpose
) {
  const { data, error } = await admin
    .from("ticket_auto_reply_templates")
    .select("id, title, template_body, purpose, is_enabled")
    .eq("is_enabled", true)
    .eq("purpose", purpose)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error?.message?.includes("purpose")) {
    return null;
  }

  return data;
}

function defaultEmailBodies(
  purpose: EmailTemplatePurpose,
  context: TicketEmailContext
): { subject: string; body: string } {
  const ticketLabel =
    formatTicketNumber(context.ticketNumber) || context.ticketId.slice(0, 8);
  const appUrl = getAppUrl();
  const ticketUrl = `${appUrl}/ticket/${context.ticketId}`;

  if (purpose === "ticket_open") {
    return {
      subject: `Richiesta ricevuta ${ticketLabel}`,
      body: [
        "Ciao,",
        "",
        `abbiamo ricevuto la tua richiesta ${ticketLabel}.`,
        "Il nostro team la prenderà in carico al più presto.",
        "",
        `Puoi seguire gli aggiornamenti qui: ${ticketUrl}`,
        "",
        "Yocabè Customer Operations",
      ].join("\n"),
    };
  }

  if (purpose === "ticket_close") {
    return {
      subject: `Ticket ${ticketLabel} chiuso`,
      body: [
        "Ciao,",
        "",
        `il ticket ${ticketLabel} è stato chiuso.`,
        "",
        `Per consultare lo storico: ${ticketUrl}`,
        "",
        "Yocabè Customer Operations",
      ].join("\n"),
    };
  }

  return {
    subject: `Aggiornamento ticket ${ticketLabel}`,
    body: [
      "Ciao,",
      "",
      `abbiamo registrato una risposta sul tuo ticket ${ticketLabel}.`,
      "",
      String(context.replyBody ?? "").trim(),
      "",
      `Leggi la conversazione completa: ${ticketUrl}`,
      "",
      "Yocabè Customer Operations",
    ]
      .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""))
      .join("\n"),
  };
}

export async function buildUserEmailMessage(
  admin: SupabaseClient,
  purpose: Extract<EmailTemplatePurpose, "ticket_open" | "ticket_close" | "user_reply">,
  context: TicketEmailContext
): Promise<{ subject: string; body: string }> {
  const template = await findEnabledEmailTemplate(admin, purpose);
  const defaults = defaultEmailBodies(purpose, context);

  if (!template?.template_body) {
    return defaults;
  }

  const body = applyEmailTemplateVars(String(template.template_body), context).trim();
  const subjectTemplate = String(template.title ?? "").trim();
  const subject = subjectTemplate
    ? applyEmailTemplateVars(subjectTemplate, context)
    : defaults.subject;

  return {
    subject,
    body: body || defaults.body,
  };
}

export async function queueTicketUserEmail(
  admin: SupabaseClient,
  options: {
    ticketId: string;
    requester: RequesterProfile;
    requestedBy: string;
    purpose: Extract<EmailTemplatePurpose, "ticket_open" | "ticket_close" | "user_reply">;
    context: TicketEmailContext;
    eventType: string;
    eventDescription: string;
  }
): Promise<{ queued: boolean; reason?: string }> {
  const systemUserId = process.env.EMAIL_INGEST_SYSTEM_USER_ID;
  const requesterEmail = extractEmailAddress(options.requester.email);
  const isAppUser = options.requester.role === "user";

  if (!requesterEmail) {
    return { queued: false, reason: "missing_email" };
  }
  if (!isAppUser) {
    return { queued: false, reason: "not_app_user" };
  }
  if (systemUserId && options.requester.id === systemUserId) {
    return { queued: false, reason: "system_user" };
  }

  const { subject, body } = await buildUserEmailMessage(
    admin,
    options.purpose,
    options.context
  );

  const { error } = await admin.from("ticket_email_replies").insert({
    ticket_id: options.ticketId,
    requested_by: options.requestedBy,
    to_email: requesterEmail,
    subject,
    body,
    thread_id: null,
    status: "pending",
  });

  if (error) {
    return { queued: false, reason: error.message };
  }

  await admin.from("ticket_events").insert({
    ticket_id: options.ticketId,
    user_id: options.requestedBy,
    type: options.eventType,
    description: options.eventDescription,
  });

  return { queued: true };
}
