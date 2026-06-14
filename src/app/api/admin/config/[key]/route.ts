import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/guards";

const ALLOWED_KEYS = new Set([
  "eodhd",
  "yahoo",
  "coingecko",
  "goldapi",
  "finnhub",
  "frankfurter",
  "anthropic",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { adminClient, user, error: authError } = await requireAdmin();
  if (authError) return authError;

  const { key } = await params;
  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: "Unknown config key" }, { status: 400 });
  }

  const { active } = await req.json();
  if (typeof active !== "boolean") {
    return NextResponse.json(
      { error: "active must be a boolean" },
      { status: 400 },
    );
  }

  const { error } = await adminClient
    .from("app_config")
    .update({ value: active, updated_at: new Date().toISOString() })
    .eq("key", key);

  if (error) {
    console.error("[admin/config] DB error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  await adminClient.from("audit_log").insert({
    actor_id: user.id,
    action: "config_update",
    target_id: key,
    detail: { active },
  });

  return NextResponse.json({ key, active });
}
