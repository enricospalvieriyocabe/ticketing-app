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

export function buildProfilePayload(
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
  existing?: ProfileRow | null
) {
  const meta = user.user_metadata ?? {};
  const email = user.email?.toLowerCase() ?? "";

  return {
    id: user.id,
    email,
    first_name:
      existing?.first_name ??
      readMetaString(meta, "first_name"),
    last_name:
      existing?.last_name ??
      readMetaString(meta, "last_name"),
    full_name:
      existing?.full_name ??
      readMetaString(meta, "full_name") ??
      (readMetaString(meta, "first_name") && readMetaString(meta, "last_name")
        ? `${readMetaString(meta, "first_name")} ${readMetaString(meta, "last_name")}`
        : null),
    company_name:
      existing?.company_name ??
      readMetaString(meta, "company_name"),
    role: existing?.role ?? readMetaString(meta, "role") ?? "user",
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

  if (profileById) {
    return { profile: profileById };
  }

  const { data: profileByEmail } = await admin
    .from("profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (email) {
    await removeStaleProfileByEmail(admin, email, user.id);
  }

  const profilePayload = buildProfilePayload(user, profileByEmail);

  const { data: profile, error: upsertError } = await admin
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" })
    .select("*")
    .single();

  if (upsertError) {
    return { profile: null, error: upsertError.message };
  }

  return { profile, repaired: Boolean(profileByEmail) };
}
