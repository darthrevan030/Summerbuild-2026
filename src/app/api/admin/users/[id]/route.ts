import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: callerSettings } = await supabase
    .from("user_settings")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (callerSettings?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: targetId } = await params;
  const { role } = await req.json();

  if (role !== "admin" && role !== "user") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Prevent removing the last admin
  if (role === "user") {
    const { count } = await supabase
      .from("user_settings")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last admin" },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase
    .from("user_settings")
    .update({ role })
    .eq("user_id", targetId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ role });
}
