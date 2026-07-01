import type { SupabaseClient } from "@supabase/supabase-js";

import { formatTicketNumber } from "@/lib/ticket-number";

export async function notifyTicketOwnerOnNewReply(
  admin: SupabaseClient,
  options: {
    ticketId: string;
    requesterId?: string | null;
    actorUserId: string;
    ticketNumber?: number | string | null;
  }
): Promise<boolean> {
  const { ticketId, requesterId, actorUserId, ticketNumber } = options;
  const systemUserId = process.env.EMAIL_INGEST_SYSTEM_USER_ID;

  if (!requesterId || requesterId === actorUserId) {
    return false;
  }
  if (systemUserId && requesterId === systemUserId) {
    return false;
  }

  const ticketLabel = formatTicketNumber(ticketNumber) || "ticket";
  const message = `Nuova risposta sul tuo ${ticketLabel}`;

  const { error } = await admin.from("notifications").insert({
    user_id: requesterId,
    ticket_id: ticketId,
    type: "info",
    message,
    read: false,
  });

  return !error;
}
