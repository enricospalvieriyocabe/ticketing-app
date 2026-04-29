import { getSupabaseAdmin } from "@/lib/supabase-admin";

function isAuthorized(req: Request) {
  const expectedToken = process.env.EMAIL_INGEST_TOKEN;
  if (!expectedToken) return false;
  const auth = req.headers.get("authorization");
  return auth?.toLowerCase() === `bearer ${expectedToken}`.toLowerCase();
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("ticket_email_replies")
    .select("id, ticket_id, to_email, subject, body, thread_id, requested_by, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, items: data ?? [] });
}
