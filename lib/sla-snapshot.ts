import type { SupabaseClient } from "@supabase/supabase-js";

type SlaPolicyRow = {
  id: number;
  priority: number;
  weekdays: number[] | null;
  start_time: string;
  end_time: string;
  sla_hours: number;
  category: string | null;
  ticket_priority: string | null;
  auto_reply_template_id: number | null;
};

export type SlaSnapshot = {
  sla_policy_id: number;
  sla_hours: number;
  sla_due_at: string;
  sla_status: string;
};

function getEuropeRomeParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const weekday = (parts.find((p) => p.type === "weekday")?.value ?? "Mon").toLowerCase();
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const second = parts.find((p) => p.type === "second")?.value ?? "00";
  return { weekday, timeString: `${hour}:${minute}:${second}` };
}

function parseTimeToSeconds(timeValue: string) {
  const chunks = (timeValue || "00:00:00").split(":").map((chunk) => Number(chunk));
  const hh = chunks[0] ?? 0;
  const mm = chunks[1] ?? 0;
  const ss = chunks[2] ?? 0;
  return hh * 3600 + mm * 60 + ss;
}

function matchesSlaWindow(currentTime: string, startTime: string, endTime: string) {
  const nowSec = parseTimeToSeconds(currentTime);
  const startSec = parseTimeToSeconds(startTime);
  const endSec = parseTimeToSeconds(endTime);
  if (startSec <= endSec) return nowSec >= startSec && nowSec <= endSec;
  return nowSec >= startSec || nowSec <= endSec;
}

export async function findSlaSnapshotForTicket(
  admin: SupabaseClient,
  createdAtIso: string,
  ticketCategory: string,
  ticketPriority: string
): Promise<SlaSnapshot | null> {
  const createdDate = new Date(createdAtIso);
  if (Number.isNaN(createdDate.getTime())) return null;

  const weekdayMap: Record<string, number> = {
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
    sun: 7,
  };
  const { weekday, timeString } = getEuropeRomeParts(createdDate);
  const currentWeekday = weekdayMap[weekday] ?? null;
  if (!currentWeekday) return null;

  const { data: policies, error } = await admin
    .from("sla_policies")
    .select(
      "id, priority, weekdays, start_time, end_time, sla_hours, category, ticket_priority, auto_reply_template_id"
    )
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (error || !policies?.length) return null;

  const matchingPolicy = (policies as SlaPolicyRow[]).find((policy) => {
    const weekdays = policy.weekdays ?? [];
    if (!weekdays.includes(currentWeekday)) return false;
    if (!matchesSlaWindow(timeString, policy.start_time, policy.end_time)) return false;

    const policyCategory = String(policy.category ?? "").trim();
    if (policyCategory && policyCategory !== ticketCategory) return false;

    const policyTicketPriority = String(policy.ticket_priority ?? "").trim();
    if (policyTicketPriority && policyTicketPriority !== ticketPriority) return false;

    return true;
  });

  if (!matchingPolicy) return null;

  const slaHoursValue = Number(matchingPolicy.sla_hours);
  if (Number.isNaN(slaHoursValue) || slaHoursValue <= 0) return null;

  const dueDate = new Date(createdDate.getTime() + slaHoursValue * 3600000);
  return {
    sla_policy_id: matchingPolicy.id,
    sla_hours: slaHoursValue,
    sla_due_at: dueDate.toISOString(),
    sla_status: "on_track",
  };
}
