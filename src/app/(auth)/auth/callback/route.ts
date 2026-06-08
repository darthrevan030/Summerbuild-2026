import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/overview";
  // Reject protocol-relative (//evil.com) and backslash (/\evil.com) bypasses
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\")
      ? rawNext
      : "/overview";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
