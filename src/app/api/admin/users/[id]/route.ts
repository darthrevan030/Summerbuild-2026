import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/guards";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { adminClient, user, error: authError } = await requireAdmin();
  if (authError) return authError;

  const { id: targetId } = await params;
  const { role } = await req.json();

  if (role !== "admin" && role !== "user") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // The admin list is built from auth.users, but user_settings rows are created
  // lazily on first login — so a listed user may have no row yet. Verify the
  // account really exists in Auth (keeps a true 404 for bogus IDs and avoids
  // creating orphan rows), then upsert so the role applies either way.
  const { data: authUser, error: lookupError } =
    await adminClient.auth.admin.getUserById(targetId);
  if (lookupError || !authUser?.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Friendly fast path; the DB trigger is the race-proof backstop.
  if (role === "user") {
    const { count } = await adminClient
      .from("user_settings")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last admin" },
        { status: 409 },
      );
    }
  }

  // Upsert: updates an existing row's role, or materializes the row for a
  // never-logged-in account. Only user_id/role are in the payload, so an
  // existing row's display_name/base_currency are untouched and a new row
  // gets base_currency's DEFAULT. The last-admin trigger fires on the UPDATE
  // branch; the INSERT branch can only create a row, never demote anyone.
  const { error } = await adminClient
    .from("user_settings")
    .upsert({ user_id: targetId, role }, { onConflict: "user_id" });

  if (error) {
    if (error.message.includes("cannot demote the last admin")) {
      return NextResponse.json(
        { error: "Cannot remove the last admin" },
        { status: 409 },
      );
    }
    console.error("[admin/users] DB error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  await adminClient.from("audit_log").insert({
    actor_id: user.id,
    action: "role_change",
    target_id: targetId,
    detail: { role },
  });

  return NextResponse.json({ role });
}
