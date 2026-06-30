import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { upsertProfileForUser } from "@/lib/profile-repair";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
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

    const admin = getSupabaseAdmin();
    const { profile, error, repaired } = await upsertProfileForUser(admin, userData.user);

    if (!profile) {
      return NextResponse.json(
        { error: error ?? "profile_not_found" },
        { status: error ? 500 : 404 }
      );
    }

    return NextResponse.json({ profile, repaired: Boolean(repaired) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore imprevisto";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        {
          error:
            "Configurazione server incompleta: manca SUPABASE_SERVICE_ROLE_KEY su Vercel.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
