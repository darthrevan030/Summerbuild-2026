import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchUserSettings, upsertUserSettings } from "@/lib/supabase/data";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await fetchUserSettings(user.id);
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  await upsertUserSettings(user.id, {
    displayName: typeof body.displayName === "string" ? body.displayName : undefined,
    baseCurrency: typeof body.baseCurrency === "string" ? body.baseCurrency : undefined,
  });

  return NextResponse.json({ ok: true });
}
