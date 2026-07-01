import type { SupabaseClient } from "@supabase/supabase-js";

import type { TicketConfigItem } from "@/lib/ticket-config";

async function countTicketsByField(
  admin: SupabaseClient,
  field: "category" | "case_type",
  code: string
) {
  const { count, error } = await admin
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq(field, code);

  if (error) return 0;
  return count ?? 0;
}

async function countSlaPoliciesByCategory(admin: SupabaseClient, code: string) {
  const { count, error } = await admin
    .from("sla_policies")
    .select("id", { count: "exact", head: true })
    .eq("category", code);

  if (error) return 0;
  return count ?? 0;
}

export async function enrichCategoriesWithUsage(
  admin: SupabaseClient,
  items: TicketConfigItem[]
): Promise<TicketConfigItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const [ticket_count, policy_count] = await Promise.all([
        countTicketsByField(admin, "category", item.code),
        countSlaPoliciesByCategory(admin, item.code),
      ]);
      return { ...item, ticket_count, policy_count };
    })
  );
}

export async function enrichCaseTypesWithUsage(
  admin: SupabaseClient,
  items: TicketConfigItem[]
): Promise<TicketConfigItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const ticket_count = await countTicketsByField(admin, "case_type", item.code);
      return { ...item, ticket_count };
    })
  );
}

export async function getCategoryUsage(admin: SupabaseClient, code: string) {
  const [ticket_count, policy_count] = await Promise.all([
    countTicketsByField(admin, "category", code),
    countSlaPoliciesByCategory(admin, code),
  ]);
  return { ticket_count, policy_count };
}

export async function getCaseTypeUsage(admin: SupabaseClient, code: string) {
  const ticket_count = await countTicketsByField(admin, "case_type", code);
  return { ticket_count };
}
