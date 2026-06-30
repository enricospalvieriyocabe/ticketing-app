import { supabase } from "./supabase";

type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

export async function syncProfileFromMetadata(currentUser: AuthUserLike) {
  const meta = currentUser.user_metadata ?? {};
  const payload: Record<string, string | null> = {
    id: currentUser.id,
    email: currentUser.email ?? null,
  };

  if (typeof meta.first_name === "string" && meta.first_name.trim()) {
    payload.first_name = meta.first_name.trim();
  }
  if (typeof meta.last_name === "string" && meta.last_name.trim()) {
    payload.last_name = meta.last_name.trim();
  }
  if (typeof meta.full_name === "string" && meta.full_name.trim()) {
    payload.full_name = meta.full_name.trim();
  } else if (payload.first_name && payload.last_name) {
    payload.full_name = `${payload.first_name} ${payload.last_name}`;
  }
  if (typeof meta.company_name === "string" && meta.company_name.trim()) {
    payload.company_name = meta.company_name.trim();
  }

  return supabase.from("profiles").upsert(payload, { onConflict: "id" });
}
