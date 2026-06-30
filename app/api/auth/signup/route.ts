import { NextResponse } from "next/server";

import { authCallbackUrl } from "@/lib/app-url";
import { removeStaleProfileByEmail, upsertProfileForUser } from "@/lib/profile-repair";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type SignupBody = {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
};

function profileUserPayload(
  userId: string,
  email: string,
  firstName: string,
  lastName: string,
  fullName: string,
  companyName: string
) {
  return {
    id: userId,
    email,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      company_name: companyName,
      role: "user",
    },
  };
}

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
    const profileMeta = profileUserPayload(
      "",
      email,
      firstName,
      lastName,
      fullName,
      companyName
    ).user_metadata;

    const { data, error } = await admin.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authCallbackUrl(),
        data: profileMeta,
      },
    });

    if (error) {
      const message = error.message.toLowerCase();
      const rateLimited =
        message.includes("email rate limit") || message.includes("rate limit exceeded");

      if (rateLimited) {
        const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 });
        const existingUser = listed.users.find(
          (user) => user.email?.toLowerCase() === email
        );
        const userId = existingUser?.id ?? null;

        if (userId) {
          await admin.auth.admin.updateUserById(userId, {
            user_metadata: profileMeta,
          });
          await removeStaleProfileByEmail(admin, email, userId);
          const { profile, error: profileError } = await upsertProfileForUser(
            admin,
            profileUserPayload(userId, email, firstName, lastName, fullName, companyName)
          );

          if (profileError || !profile?.company_name) {
            return NextResponse.json(
              { error: profileError ?? "Profilo non salvato correttamente" },
              { status: 500 }
            );
          }

          return NextResponse.json({
            status: "pending_confirmation",
            email,
            userId,
            emailSkipped: true,
            warning:
              "Account creato ma email di conferma non inviata per limite Supabase. Conferma manualmente l'utente in Authentication → Users.",
          });
        }
      }

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

    await admin.auth.admin.updateUserById(data.user.id, {
      user_metadata: profileMeta,
    });

    await removeStaleProfileByEmail(admin, email, data.user.id);

    const { profile, error: profileError } = await upsertProfileForUser(
      admin,
      profileUserPayload(data.user.id, email, firstName, lastName, fullName, companyName)
    );

    if (profileError || !profile?.first_name || !profile?.company_name) {
      return NextResponse.json(
        {
          error: profileError
            ? `Profilo non salvato: ${profileError}`
            : "Profilo incompleto dopo la registrazione. Riprova.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: data.session ? "complete" : "pending_confirmation",
      email,
      userId: data.user.id,
      profile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore imprevisto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
