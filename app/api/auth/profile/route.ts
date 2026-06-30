import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

function readMetaString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function GET(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Sessione non valida" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Configurazione mancante" }, { status: 500 });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Sessione non valida" }, { status: 401 });
    }

    const user = userData.user;
    const admin = getSupabaseAdmin();
    const { data: profileById, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (profileById) {
      return NextResponse.json({ profile: profileById });
    }

    const email = user.email?.toLowerCase() ?? "";
    const { data: profileByEmail } = await admin
      .from("profiles")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    const meta = user.user_metadata ?? {};
    const profilePayload = {
      id: user.id,
      email,
      first_name:
        profileByEmail?.first_name ??
        readMetaString(meta, "first_name"),
      last_name:
        profileByEmail?.last_name ??
        readMetaString(meta, "last_name"),
      full_name:
        profileByEmail?.full_name ??
        readMetaString(meta, "full_name") ??
        (readMetaString(meta, "first_name") && readMetaString(meta, "last_name")
          ? `${readMetaString(meta, "first_name")} ${readMetaString(meta, "last_name")}`
          : null),
      company_name:
        profileByEmail?.company_name ??
        readMetaString(meta, "company_name"),
      role: profileByEmail?.role ?? readMetaString(meta, "role") ?? "user",
    };

    if (profileByEmail && profileByEmail.id !== user.id) {
      await admin.from("profiles").delete().eq("id", profileByEmail.id);
    }

    const { data: profile, error: upsertError } = await admin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })
      .select("*")
      .single();

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ profile, repaired: Boolean(profileByEmail) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore imprevisto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
