import { getSupabaseAdmin } from "@/lib/supabase-admin";

type ReplyPayload = {
  body?: string;
  actorUserId?: string;
};

function extractEmailAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const angleMatch = value.match(/<([^>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1].trim();
  const plainMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return plainMatch?.[0] ?? null;
}

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/ticket/[id]/reply">
) {
  const systemUserId = process.env.EMAIL_INGEST_SYSTEM_USER_ID;
  if (!systemUserId) {
    return Response.json({ ok: false, error: "Missing EMAIL_INGEST_SYSTEM_USER_ID." }, { status: 500 });
  }

  const { id: ticketId } = await ctx.params;
  const supabaseAdmin = getSupabaseAdmin();

  let payload: ReplyPayload;
  try {
    payload = (await req.json()) as ReplyPayload;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const replyBody = String(payload.body ?? "").trim();
  if (!replyBody) {
    return Response.json({ ok: false, error: "Reply body is required" }, { status: 400 });
  }

  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from("tickets")
    .select("id, title")
    .eq("id", ticketId)
    .single();

  if (ticketError || !ticket) {
    return Response.json({ ok: false, error: "Ticket not found" }, { status: 404 });
  }

  const { data: lastInbound, error: inboundError } = await supabaseAdmin
    .from("email_ingest_log")
    .select("thread_id, from_email, subject")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inboundError || !lastInbound) {
    return Response.json(
      { ok: false, error: "No inbound email context found for this ticket." },
      { status: 400 }
    );
  }

  const recipientEmail = extractEmailAddress(lastInbound.from_email);
  if (!recipientEmail) {
    return Response.json({ ok: false, error: "Cannot resolve recipient email." }, { status: 400 });
  }

  const originalSubject = String(lastInbound.subject || ticket.title || "").trim();
  const subject = /^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`;

  const actorUserId = String(payload.actorUserId ?? "").trim() || systemUserId;

  const { data: queuedReply, error: queueError } = await supabaseAdmin
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
    return Response.json(
      { ok: false, error: queueError?.message ?? "Cannot queue email reply" },
      { status: 500 }
    );
  }

  const commentMarker = `[email-reply-id:${queuedReply.id}]`;
  await supabaseAdmin.from("ticket_comments").insert({
    ticket_id: ticketId,
    user_id: actorUserId,
    body: `${commentMarker}\n📤 Risposta cliente (in coda)\n\n${replyBody}`,
  });

  await supabaseAdmin.from("ticket_events").insert({
    ticket_id: ticketId,
    user_id: actorUserId,
    type: "outbound_email_queued",
    description: `Risposta email in coda per ${recipientEmail}`,
  });

  return Response.json({
    ok: true,
    queued: true,
    queueId: queuedReply.id,
    recipientEmail,
    threadId: lastInbound.thread_id,
  });
}
