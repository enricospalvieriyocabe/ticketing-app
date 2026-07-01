import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const STAFF_COMPOSE_PURPOSES = new Set(["compose", "off_hours"]);

export async function GET(request: Request) {
  const auth = await requireStaff(request);
  if (auth.error) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const admin = getSupabaseAdmin();
  let data: Array<{
    id: number;
    title: string | null;
    template_body: string | null;
    is_enabled: boolean | null;
    purpose?: string | null;
  }> | null = null;
  let error: { message: string } | null = null;

  const withPurpose = await admin
    .from("ticket_auto_reply_templates")
    .select("id, title, template_body, is_enabled, purpose, updated_at")
    .eq("is_enabled", true)
    .order("id", { ascending: true });

  if (withPurpose.error?.message?.includes("purpose")) {
    const fallback = await admin
      .from("ticket_auto_reply_templates")
      .select("id, title, template_body, is_enabled, updated_at")
      .eq("is_enabled", true)
      .order("id", { ascending: true });
    data = fallback.data;
    error = fallback.error;
  } else {
    data = withPurpose.data;
    error = withPurpose.error;
  }

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const templates = (data ?? []).filter((template) => {
    if (!("purpose" in template) || template.purpose == null) return true;
    return STAFF_COMPOSE_PURPOSES.has(String(template.purpose));
  });

  return NextResponse.json({
    ok: true,
    templates: templates.map((template) => ({
      id: template.id,
      title: template.title,
      template_body: template.template_body,
      purpose: "purpose" in template ? (template.purpose ?? "compose") : "compose",
    })),
  });
}
