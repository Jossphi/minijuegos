"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function useAdminAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run<T = unknown>(action: string, args: Record<string, unknown> = {}, confirmText?: string): Promise<T | undefined> {
    if (confirmText && !window.confirm(confirmText)) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, args }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Error");
        return;
      }
      startTransition(() => router.refresh());
      return json as T;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy: busy || pending, error, setError };
}
