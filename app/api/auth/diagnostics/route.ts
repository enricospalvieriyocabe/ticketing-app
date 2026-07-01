import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null;

  return NextResponse.json({
    supabaseProject: projectRef,
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasEmailIngestToken: Boolean(process.env.EMAIL_INGEST_TOKEN),
    hasEmailIngestSystemUserId: Boolean(process.env.EMAIL_INGEST_SYSTEM_USER_ID),
    emailIngestSystemUserIdLength: (process.env.EMAIL_INGEST_SYSTEM_USER_ID ?? "").trim().length,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
  });
}
