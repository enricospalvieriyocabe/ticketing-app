import { NextResponse } from "next/server";

import { authCallbackUrl } from "@/lib/app-url";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type SignupBody = {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignupBody;

    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");
    const firstName = String(body.first_name ?? "").trim();
    const lastName = String(body.last_name ?? "").trim();
    const companyName = String(body.company_name ?? "").trim();
    const fullName = `${firstName} ${lastName}`.trim();

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "Inserisci nome e cognome" }, { status: 400 });
    }

    if (!companyName) {
      return NextResponse.json({ error: "Inserisci il nome dell'azienda" }, { status: 400 });
    }

    if (!email || !password.trim()) {
      return NextResponse.json({ error: "Inserisci email e password" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data, error } = await admin.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authCallbackUrl(),
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          company_name: companyName,
        },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (data.user?.identities?.length === 0) {
      return NextResponse.json(
        { error: "already_registered", email },
        { status: 409 }
      );
    }

    if (!data.user?.id) {
      return NextResponse.json(
        { error: "Registrazione non completata. Riprova." },
        { status: 500 }
      );
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: data.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        company_name: companyName,
        role: "user",
      },
      { onConflict: "id" }
    );

    if (profileError) {
      return NextResponse.json(
        { error: `Profilo non salvato: ${profileError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: data.session ? "complete" : "pending_confirmation",
      email,
      userId: data.user.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore imprevisto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
