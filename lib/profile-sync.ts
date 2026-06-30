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

export type ProfileLoadResult = {
  profile: Record<string, unknown> | null;
  error?: string;
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

async function getAccessToken(explicitToken?: string) {
  if (explicitToken) return explicitToken;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return null;
}

async function fetchProfileFromApi(token: string) {
  const response = await fetch("/api/auth/profile", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function ensureProfileOnServer(currentUser: AuthUserLike) {
  const meta = currentUser.user_metadata ?? {};
  const response = await fetch("/api/auth/ensure-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: currentUser.id,
      email: currentUser.email,
      first_name: meta.first_name,
      last_name: meta.last_name,
      company_name: meta.company_name,
      role: meta.role,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function fetchCurrentUserProfile(
  currentUser: AuthUserLike,
  options?: { accessToken?: string }
): Promise<ProfileLoadResult> {
  const token = await getAccessToken(options?.accessToken);
  if (!token) {
    return {
      profile: null,
      error: "Sessione non ancora pronta. Attendi un secondo e riprova.",
    };
  }

  let { response, payload } = await fetchProfileFromApi(token);
  if (response.ok && payload.profile) {
    return { profile: payload.profile };
  }

  if (!response.ok && payload.error) {
    const serverError = String(payload.error);
    if (
      serverError.includes("SUPABASE_SERVICE_ROLE_KEY") ||
      serverError.includes("Configurazione server")
    ) {
      return { profile: null, error: serverError };
    }
  }

  const ensured = await ensureProfileOnServer(currentUser);
  if (!ensured.response.ok) {
    return {
      profile: null,
      error: String(ensured.payload.error ?? "Impossibile creare il profilo sul server."),
    };
  }

  ({ response, payload } = await fetchProfileFromApi(token));
  if (response.ok && payload.profile) {
    return { profile: payload.profile };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (profile) {
    return { profile };
  }

  return {
    profile: null,
    error: String(
      payload.error ??
        "Impossibile caricare il profilo. Verifica SUPABASE_SERVICE_ROLE_KEY su Vercel."
    ),
  };
}

export async function ensureUserProfile(currentUser: AuthUserLike) {
  const result = await fetchCurrentUserProfile(currentUser);
  return { error: result.error ?? null };
}

export async function syncProfileFromMetadata(currentUser: AuthUserLike) {
  const result = await fetchCurrentUserProfile(currentUser);
  if (result.profile) {
    clearSignupDraft();
  }
  return { error: result.error ?? null };
}
