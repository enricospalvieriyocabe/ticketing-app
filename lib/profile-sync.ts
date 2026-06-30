import { supabase } from "./supabase";

const SIGNUP_DRAFT_KEY = "ticketing_signup_draft";

type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

export type SignupDraft = {
  email: string;
  first_name: string;
  last_name: string;
  company_name: string;
};

export function rememberSignupDraft(draft: SignupDraft) {
  sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(draft));
}

export function clearSignupDraft() {
  sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
}

function readSignupDraft(email?: string | null): SignupDraft | null {
  const raw = sessionStorage.getItem(SIGNUP_DRAFT_KEY);
  if (!raw) return null;

  try {
    const draft = JSON.parse(raw) as SignupDraft;
    if (email && draft.email.toLowerCase() !== email.toLowerCase()) {
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function buildProfilePayload(currentUser: AuthUserLike) {
  const draft = readSignupDraft(currentUser.email);
  const meta = currentUser.user_metadata ?? {};

  const firstName =
    (typeof meta.first_name === "string" && meta.first_name.trim()) ||
    draft?.first_name?.trim() ||
    "";
  const lastName =
    (typeof meta.last_name === "string" && meta.last_name.trim()) ||
    draft?.last_name?.trim() ||
    "";
  const companyName =
    (typeof meta.company_name === "string" && meta.company_name.trim()) ||
    draft?.company_name?.trim() ||
    "";
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (firstName && lastName ? `${firstName} ${lastName}` : "");

  const payload: Record<string, string | null> = {
    id: currentUser.id,
    email: currentUser.email ?? null,
    role:
      (typeof meta.role === "string" && meta.role.trim()) ||
      (typeof meta.app_role === "string" && meta.app_role.trim()) ||
      "user",
  };

  if (firstName) payload.first_name = firstName;
  if (lastName) payload.last_name = lastName;
  if (fullName) payload.full_name = fullName;
  if (companyName) payload.company_name = companyName;

  return payload;
}

export async function ensureUserProfile(currentUser: AuthUserLike) {
  await supabase.auth.refreshSession();
  const { data: refreshed } = await supabase.auth.getUser();
  const user = refreshed.user ?? currentUser;
  const payload = buildProfilePayload(user);

  const { error: rpcError } = await supabase.rpc("sync_profile_from_auth");
  if (!rpcError) {
    clearSignupDraft();
    return { error: null };
  }

  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  if (!upsertError) {
    clearSignupDraft();
  }

  return { error: upsertError ?? rpcError };
}

export async function syncProfileFromMetadata(currentUser: AuthUserLike) {
  await supabase.auth.refreshSession();
  const { data: refreshed } = await supabase.auth.getUser();
  const user = refreshed.user ?? currentUser;

  const payload = buildProfilePayload(user);
  const hasExtraProfileFields =
    payload.first_name || payload.last_name || payload.full_name || payload.company_name;

  if (!hasExtraProfileFields) {
    return ensureUserProfile(currentUser);
  }

  const { error: rpcError } = await supabase.rpc("sync_profile_from_auth");
  if (!rpcError) {
    clearSignupDraft();
    return { error: null };
  }

  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  if (!upsertError) {
    clearSignupDraft();
  }

  return { error: upsertError ?? rpcError };
}
