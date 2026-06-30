import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

type EnsureProfileBody = {
  userId?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  role?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EnsureProfileBody;
    const userId = String(body.userId ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!userId || !email) {
      return NextResponse.json({ error: "Utente non valido" }, { status: 400 });
    }

    const firstName = String(body.first_name ?? "").trim();
    const lastName = String(body.last_name ?? "").trim();
    const companyName = String(body.company_name ?? "").trim();
    const fullName =
      firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || null;
    const role = String(body.role ?? "user").trim() || "user";

    const admin = getSupabaseAdmin();
    const { error } = await admin.from("profiles").upsert(
      {
        id: userId,
        email,
        first_name: firstName || null,
        last_name: lastName || null,
        full_name: fullName,
        company_name: companyName || null,
        role,
      },
      { onConflict: "id" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore imprevisto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
