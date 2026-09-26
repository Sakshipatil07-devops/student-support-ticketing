"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RunSlaCheckButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setMessage(null);
    const res = await fetch("/api/sla/recalculate", { method: "POST" });
    if (!res.ok) {
      setMessage("Failed to run SLA check.");
      return;
    }
    const data = (await res.json()) as { checked: number; escalated: number };
    setMessage(`Checked ${data.checked} open tickets, escalated ${data.escalated}.`);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={pending}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {pending ? "Refreshing…" : "Run SLA check now"}
      </button>
      {message && <span className="text-xs text-gray-500 dark:text-gray-400">{message}</span>}
    </div>
  );
}
