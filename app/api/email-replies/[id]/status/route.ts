import { getSupabaseAdmin } from "@/lib/supabase-admin";

type StatusPayload = {
  status?: "sent" | "failed";
  externalMessageId?: string | null;
  errorMessage?: string | null;
};

function isAuthorized(req: Request) {
  const expectedToken = process.env.EMAIL_INGEST_TOKEN;
  if (!expectedToken) return false;
  const auth = req.headers.get("authorization");
  return auth?.toLowerCase() === `bearer ${expectedToken}`.toLowerCase();
}

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/email-replies/[id]/status">
) {
  if (!isAuthorized(req)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: StatusPayload;
  try {
    payload = (await req.json()) as StatusPayload;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const status = payload.status;
  if (status !== "sent" && status !== "failed") {
    return Response.json({ ok: false, error: "status must be sent or failed" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const supabaseAdmin = getSupabaseAdmin();

  const { data: queueItem, error: queueError } = await supabaseAdmin
    .from("ticket_email_replies")
    .select("id, ticket_id, requested_by, to_email")
    .eq("id", id)
    .single();

  if (queueError || !queueItem) {
    return Response.json({ ok: false, error: "Queue item not found" }, { status: 404 });
  }

  const updatePayload: Record<string, string | null> = {
    status,
    external_message_id: payload.externalMessageId ?? null,
    error_message: payload.errorMessage ?? null,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  };

  const { error: updateError } = await supabaseAdmin
    .from("ticket_email_replies")
    .update(updatePayload)
    .eq("id", id);

  if (updateError) {
    return Response.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  const actorUserId = queueItem.requested_by ?? process.env.EMAIL_INGEST_SYSTEM_USER_ID;
  if (actorUserId) {
    await supabaseAdmin.from("ticket_events").insert({
      ticket_id: queueItem.ticket_id,
      user_id: actorUserId,
      type: status === "sent" ? "outbound_email" : "outbound_email_failed",
      description:
        status === "sent"
          ? `Email inviata a ${queueItem.to_email}`
          : `Invio email fallito verso ${queueItem.to_email}: ${payload.errorMessage ?? "errore non specificato"}`,
    });
  }

  return Response.json({ ok: true });
}
