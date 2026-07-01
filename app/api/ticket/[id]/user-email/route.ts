import { getAuthUserFromRequest, requireStaff } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { queueTicketUserEmail } from "@/lib/ticket-email-notifications";

type NotifyPayload = {
  type?: "open" | "close";
};

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/ticket/[id]/user-email">
) {
  const { id: ticketId } = await ctx.params;

  let payload: NotifyPayload;
  try {
    payload = (await req.json()) as NotifyPayload;
  } catch {
    return Response.json({ ok: false, error: "Payload JSON non valido" }, { status: 400 });
  }

  const notifyType = payload.type;
  if (notifyType !== "open" && notifyType !== "close") {
    return Response.json({ ok: false, error: "type deve essere open o close" }, { status: 400 });
  }

  const auth =
    notifyType === "close"
      ? await requireStaff(req)
      : await getAuthUserFromRequest(req);

  if (auth.error || !auth.user) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const admin = getSupabaseAdmin();
  const { data: ticket, error: ticketError } = await admin
    .from("tickets")
    .select("id, title, ticket_number, requester_id")
    .eq("id", ticketId)
    .single();

  if (ticketError || !ticket?.requester_id) {
    return Response.json({ ok: false, error: "Ticket non trovato" }, { status: 404 });
  }

  if (notifyType === "open" && ticket.requester_id !== auth.user.id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (!profile || !["operator", "team_leader"].includes(profile.role)) {
      return Response.json({ ok: false, error: "Non autorizzato" }, { status: 403 });
    }
  }

  const { data: requester, error: requesterError } = await admin
    .from("profiles")
    .select("id, email, role")
    .eq("id", ticket.requester_id)
    .maybeSingle();

  if (requesterError || !requester) {
    return Response.json({ ok: false, error: "Richiedente non trovato" }, { status: 404 });
  }

  const purpose = notifyType === "open" ? "ticket_open" : "ticket_close";
  const result = await queueTicketUserEmail(admin, {
    ticketId,
    requester,
    requestedBy: auth.user.id,
    purpose,
    context: {
      ticketId,
      ticketNumber: ticket.ticket_number,
      title: ticket.title,
    },
    eventType: notifyType === "open" ? "user_open_email_queued" : "user_close_email_queued",
    eventDescription:
      notifyType === "open"
        ? `Email apertura ticket in coda per ${requester.email}`
        : `Email chiusura ticket in coda per ${requester.email}`,
  });

  return Response.json({
    ok: true,
    queued: result.queued,
    reason: result.reason ?? null,
  });
}
