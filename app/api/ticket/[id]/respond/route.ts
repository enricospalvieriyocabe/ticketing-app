import { requireStaff } from "@/lib/api-auth";
import { autoAssignTicketOnStaffAction } from "@/lib/ticket-staff-actions";
import { queueTicketUserEmail } from "@/lib/ticket-email-notifications";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type RespondPayload = {
  body?: string;
};

function extractEmailAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const angleMatch = value.match(/<([^>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1].trim();
  const plainMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return plainMatch?.[0] ?? null;
}

async function queueEmailReply(
  admin: ReturnType<typeof getSupabaseAdmin>,
  ticketId: string,
  actorUserId: string,
  replyBody: string,
  ticket: {
    id: string;
    title?: string | null;
    assigned_to?: string | null;
    status?: string | null;
    category?: string | null;
    priority?: string | null;
    sla_policy_id?: number | null;
    created_at?: string | null;
  }
) {
  const { data: lastInbound, error: inboundError } = await admin
    .from("email_ingest_log")
    .select("thread_id, from_email, subject")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inboundError || !lastInbound) {
    return { error: "Nessun contesto email per questo ticket.", status: 400 as const };
  }

  const recipientEmail = extractEmailAddress(lastInbound.from_email);
  if (!recipientEmail) {
    return { error: "Impossibile risolvere il mittente email.", status: 400 as const };
  }

  const originalSubject = String(lastInbound.subject || ticket.title || "").trim();
  const subject = /^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`;

  await autoAssignTicketOnStaffAction(admin, ticket, actorUserId, "prima risposta");

  const { data: queuedReply, error: queueError } = await admin
    .from("ticket_email_replies")
    .insert({
      ticket_id: ticketId,
      requested_by: actorUserId,
      to_email: recipientEmail,
      subject,
      body: replyBody,
      thread_id: lastInbound.thread_id,
      status: "pending",
    })
    .select("id")
    .single();

  if (queueError || !queuedReply?.id) {
    return {
      error: queueError?.message ?? "Impossibile accodare la risposta email.",
      status: 500 as const,
    };
  }

  const commentMarker = `[email-reply-id:${queuedReply.id}]`;
  const statusMarker = "[email-reply-status:pending]";
  await admin.from("ticket_comments").insert({
    ticket_id: ticketId,
    user_id: actorUserId,
    body: `${commentMarker}\n${statusMarker}\n${replyBody}`,
  });

  await admin.from("ticket_events").insert({
    ticket_id: ticketId,
    user_id: actorUserId,
    type: "outbound_email_queued",
    description: `Risposta email in coda per ${recipientEmail}`,
  });

  return {
    ok: true as const,
    mode: "email" as const,
    queueId: queuedReply.id,
    recipientEmail,
  };
}

async function respondToAppUser(
  admin: ReturnType<typeof getSupabaseAdmin>,
  ticketId: string,
  actorUserId: string,
  replyBody: string,
  ticket: {
    id: string;
    title?: string | null;
    assigned_to?: string | null;
    status?: string | null;
    category?: string | null;
    priority?: string | null;
    sla_policy_id?: number | null;
    created_at?: string | null;
    ticket_number?: number | null;
    requester_id?: string | null;
  }
) {
  await autoAssignTicketOnStaffAction(admin, ticket, actorUserId, "prima risposta");

  await admin.from("ticket_comments").insert({
    ticket_id: ticketId,
    user_id: actorUserId,
    body: replyBody,
  });

  await admin.from("ticket_events").insert({
    ticket_id: ticketId,
    user_id: actorUserId,
    type: "staff_reply",
    description: "Risposta staff registrata sul ticket",
  });

  const systemUserId = process.env.EMAIL_INGEST_SYSTEM_USER_ID;
  let ackQueued = false;
  let ackReason: string | null = null;

  if (ticket.requester_id && ticket.requester_id !== systemUserId) {
    const { data: requester } = await admin
      .from("profiles")
      .select("id, email, role")
      .eq("id", ticket.requester_id)
      .maybeSingle();

    if (requester) {
      const result = await queueTicketUserEmail(admin, {
        ticketId,
        requester,
        requestedBy: actorUserId,
        purpose: "user_reply",
        context: {
          ticketId,
          ticketNumber: ticket.ticket_number,
          title: ticket.title,
          replyBody,
        },
        eventType: "user_ack_email_queued",
        eventDescription: `Avviso risposta inviato a ${requester.email}`,
      });
      ackQueued = result.queued;
      ackReason = result.reason ?? null;
    }
  }

  return {
    ok: true as const,
    mode: "app_user" as const,
    ackQueued,
    ackReason,
  };
}

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/ticket/[id]/respond">
) {
  const auth = await requireStaff(req);
  if (auth.error) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id: ticketId } = await ctx.params;
  const admin = getSupabaseAdmin();

  let payload: RespondPayload;
  try {
    payload = (await req.json()) as RespondPayload;
  } catch {
    return Response.json({ ok: false, error: "Payload JSON non valido" }, { status: 400 });
  }

  const replyBody = String(payload.body ?? "").trim();
  if (!replyBody) {
    return Response.json({ ok: false, error: "Scrivi una risposta" }, { status: 400 });
  }

  const { data: ticket, error: ticketError } = await admin
    .from("tickets")
    .select(
      "id, title, assigned_to, status, category, priority, sla_policy_id, created_at, ticket_number, requester_id, source_channel"
    )
    .eq("id", ticketId)
    .single();

  if (ticketError || !ticket) {
    return Response.json({ ok: false, error: "Ticket non trovato" }, { status: 404 });
  }

  const { data: inbound } = await admin
    .from("email_ingest_log")
    .select("id")
    .eq("ticket_id", ticketId)
    .limit(1)
    .maybeSingle();

  const isEmailTicket = Boolean(inbound) || ticket.source_channel === "email";
  const actorUserId = auth.user!.id;

  if (isEmailTicket) {
    const result = await queueEmailReply(admin, ticketId, actorUserId, replyBody, ticket);
    if ("error" in result) {
      return Response.json({ ok: false, error: result.error }, { status: result.status });
    }
    return Response.json(result);
  }

  const result = await respondToAppUser(admin, ticketId, actorUserId, replyBody, ticket);
  return Response.json(result);
}
