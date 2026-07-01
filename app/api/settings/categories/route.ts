import { NextResponse } from "next/server";

import { requireTeamLeader } from "@/lib/api-auth";
import { slugifyConfigCode } from "@/lib/ticket-config";
import { DEFAULT_FORM_TEMPLATE } from "@/lib/ticket-form-templates";
import { getCategoryUsage } from "@/lib/ticket-config-usage";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CategoryBody = {
  id?: string;
  code?: string;
  label?: string;
  sort_order?: number;
  is_active?: boolean;
  form_template?: string;
};

const CATEGORY_SELECT = "id, code, label, sort_order, is_active, form_template";

export async function POST(request: Request) {
  try {
    const auth = await requireTeamLeader(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as CategoryBody;
    const label = String(body.label ?? "").trim();
    if (!label) {
      return NextResponse.json({ error: "Inserisci il nome della categoria" }, { status: 400 });
    }

    const code = slugifyConfigCode(String(body.code ?? label));
    if (!code) {
      return NextResponse.json({ error: "Codice categoria non valido" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("ticket_categories")
      .insert({
        code,
        label,
        sort_order: Number(body.sort_order ?? 100),
        is_active: body.is_active ?? true,
        form_template: String(body.form_template ?? DEFAULT_FORM_TEMPLATE),
      })
      .select(CATEGORY_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore imprevisto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireTeamLeader(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as CategoryBody;
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "Categoria non valida" }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.label !== undefined) {
      const label = String(body.label).trim();
      if (!label) {
        return NextResponse.json({ error: "Il nome non può essere vuoto" }, { status: 400 });
      }
      payload.label = label;
    }

    if (body.code !== undefined) {
      const code = slugifyConfigCode(String(body.code));
      if (!code) {
        return NextResponse.json({ error: "Codice non valido" }, { status: 400 });
      }
      payload.code = code;
    }

    if (body.sort_order !== undefined) payload.sort_order = Number(body.sort_order);
    if (body.is_active !== undefined) payload.is_active = Boolean(body.is_active);
    if (body.form_template !== undefined) {
      payload.form_template = String(body.form_template).trim() || DEFAULT_FORM_TEMPLATE;
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("ticket_categories")
      .update(payload)
      .eq("id", id)
      .select(CATEGORY_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore imprevisto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireTeamLeader(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Categoria non valida" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: existing, error: loadError } = await admin
      .from("ticket_categories")
      .select("id, code, label")
      .eq("id", id)
      .maybeSingle();

    if (loadError || !existing) {
      return NextResponse.json({ error: "Categoria non trovata" }, { status: 404 });
    }

    const { ticket_count, policy_count } = await getCategoryUsage(admin, existing.code);
    if (ticket_count > 0 || policy_count > 0) {
      return NextResponse.json(
        {
          error: `Impossibile eliminare: usata in ${ticket_count} ticket e ${policy_count} policy SLA.`,
          ticket_count,
          policy_count,
        },
        { status: 409 }
      );
    }

    const { error } = await admin.from("ticket_categories").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore imprevisto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
