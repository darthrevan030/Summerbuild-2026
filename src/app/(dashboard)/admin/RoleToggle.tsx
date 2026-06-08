"use client";

import { useState } from "react";

export function RoleToggle({ userId, initialRole }: { userId: string; initialRole: string }) {
  const [role, setRole]       = useState(initialRole);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const toggle = async () => {
    if (busy) return;
    const next = role === "admin" ? "user" : "admin";
    const prev = role;
    setRole(next);
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? res.statusText);
      }
    } catch (e) {
      setRole(prev);
      setError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
      <button
        className={"sent-pill " + (role === "admin" ? "bull" : "neut")}
        style={{ cursor: busy ? "wait" : "pointer", border: "none", background: "transparent" }}
        onClick={toggle}
        disabled={busy}
        title={role === "admin" ? "Click to demote to user" : "Click to promote to admin"}
      >
        {busy ? "…" : role}
      </button>
      {error && (
        <span className="ui muted xs" style={{ color: "var(--loss)", fontSize: 10 }}>{error}</span>
      )}
    </div>
  );
}
