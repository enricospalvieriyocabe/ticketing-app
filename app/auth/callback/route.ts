import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getAppUrl } from "@/lib/app-url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const appUrl = getAppUrl();

  if (!code) {
    return NextResponse.redirect(`${appUrl}/?auth_error=missing_code`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${appUrl}/?auth_error=config`);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${appUrl}/?auth_error=confirm`);
  }

  const safeNext = next.startsWith("/") ? next : "/";
  return NextResponse.redirect(`${appUrl}${safeNext}`);
}
