import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export async function getAuthUserFromRequest(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return { error: "Sessione non valida", status: 401 as const, user: null, role: null };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: "Configurazione mancante", status: 500 as const, user: null, role: null };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return { error: "Sessione non valida", status: 401 as const, user: null, role: null };
  }

  return {
    error: null,
    status: 200 as const,
    user: userData.user,
    token,
    role: null as string | null,
  };
}

export async function requireTeamLeader(request: Request) {
  const auth = await getAuthUserFromRequest(request);
  if (auth.error || !auth.user) {
    return { ...auth, profile: null };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      error: "Configurazione mancante",
      status: 500 as const,
      user: null,
      profile: null,
      token: null,
    };
  }

  const admin = getSupabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, email, first_name, last_name")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profileError) {
    return {
      error: profileError.message,
      status: 500 as const,
      user: auth.user,
      profile: null,
      token: auth.token,
    };
  }

  if (profile?.role !== "team_leader") {
    return {
      error: "Solo i team leader possono modificare le impostazioni",
      status: 403 as const,
      user: auth.user,
      profile,
      token: auth.token,
    };
  }

  return {
    error: null,
    status: 200 as const,
    user: auth.user,
    profile,
    token: auth.token,
  };
}
