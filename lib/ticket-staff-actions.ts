import type { SupabaseClient } from "@supabase/supabase-js";

import { findSlaSnapshotForTicket } from "@/lib/sla-snapshot";

type TicketRow = {
  id: string;
  assigned_to?: string | null;
  status?: string | null;
  category?: string | null;
  priority?: string | null;
  sla_policy_id?: number | null;
  created_at?: string | null;
};

export async function autoAssignTicketOnStaffAction(
  admin: SupabaseClient,
  ticket: TicketRow,
  actorUserId: string,
  reason: string
): Promise<boolean> {
  if (ticket.assigned_to) return false;

  const updates: Record<string, unknown> = {
    assigned_to: actorUserId,
    status: "in_progress",
  };

  if (!ticket.sla_policy_id) {
    const sla = await findSlaSnapshotForTicket(
      admin,
      ticket.created_at ?? new Date().toISOString(),
      String(ticket.category ?? "general"),
      String(ticket.priority ?? "medium")
    );
    if (sla) {
      updates.sla_policy_id = sla.sla_policy_id;
      updates.sla_hours = sla.sla_hours;
      updates.sla_due_at = sla.sla_due_at;
      updates.sla_status = sla.sla_status;
    }
  }

  const { error } = await admin
    .from("tickets")
    .update(updates)
    .eq("id", ticket.id)
    .is("assigned_to", null);

  if (error) return false;

  await admin.from("ticket_events").insert({
    ticket_id: ticket.id,
    user_id: actorUserId,
    type: "auto_assigned",
    description: `Assegnazione automatica (${reason})`,
  });

  return true;
}
