import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileRow = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  company_name?: string | null;
  role?: string | null;
};

function readMetaString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function reassignProfileReferences(
  admin: SupabaseClient,
  oldProfileId: string,
  newProfileId: string
) {
  await admin.from("tickets").update({ requester_id: newProfileId }).eq("requester_id", oldProfileId);
  await admin.from("tickets").update({ created_by: newProfileId }).eq("created_by", oldProfileId);
  await admin.from("tickets").update({ assigned_to: newProfileId }).eq("assigned_to", oldProfileId);
  await admin.from("notifications").update({ user_id: newProfileId }).eq("user_id", oldProfileId);
  await admin.from("ticket_events").update({ user_id: newProfileId }).eq("user_id", oldProfileId);
}

export async function removeStaleProfileByEmail(
  admin: SupabaseClient,
  email: string,
  keepUserId: string
) {
  const { data: staleRows } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .neq("id", keepUserId);

  for (const row of staleRows ?? []) {
    await reassignProfileReferences(admin, row.id, keepUserId);
    await admin.from("profiles").delete().eq("id", row.id);
  }
}

function nonEmpty(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function buildProfilePayload(
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
  existing?: ProfileRow | null
) {
  const meta = user.user_metadata ?? {};
  const email = user.email?.toLowerCase() ?? "";
  const metaFirst = readMetaString(meta, "first_name");
  const metaLast = readMetaString(meta, "last_name");
  const metaFull = readMetaString(meta, "full_name");
  const metaCompany = readMetaString(meta, "company_name");
  const metaRole = readMetaString(meta, "role");

  return {
    id: user.id,
    email,
    first_name: nonEmpty(existing?.first_name) ?? metaFirst,
    last_name: nonEmpty(existing?.last_name) ?? metaLast,
    full_name:
      nonEmpty(existing?.full_name) ??
      metaFull ??
      (metaFirst && metaLast ? `${metaFirst} ${metaLast}` : null),
    company_name: nonEmpty(existing?.company_name) ?? metaCompany,
    role: nonEmpty(existing?.role) ?? metaRole ?? "user",
  };
}

export async function upsertProfileForUser(
  admin: SupabaseClient,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }
) {
  const email = user.email?.toLowerCase() ?? "";

  const { data: profileById, error: profileByIdError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileByIdError) {
    return { profile: null, error: profileByIdError.message };
  }

  const { data: profileByEmail } = profileById
    ? { data: null }
    : await admin.from("profiles").select("*").eq("email", email).maybeSingle();

  if (email) {
    await removeStaleProfileByEmail(admin, email, user.id);
  }

  const profilePayload = buildProfilePayload(user, profileById ?? profileByEmail);

  const { data: profile, error: upsertError } = await admin
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" })
    .select("*")
    .single();

  if (upsertError) {
    return { profile: null, error: upsertError.message };
  }

  return { profile, repaired: Boolean(profileByEmail && profileByEmail.id !== user.id) };
}
