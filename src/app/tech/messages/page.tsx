"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { MessageSquare } from "lucide-react";
import { TechAppShell } from "@/components/layout/TechAppShell";
import type { TechInboxItem } from "@/lib/fieldMessages";

function formatInboxWhen(iso: string) {
  try {
    return format(parseISO(iso), "d MMM · HH:mm");
  } catch {
    return iso;
  }
}

export default function TechMessagesPage() {
  const [items, setItems] = useState<TechInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch("/api/tech/messages", { credentials: "include" });
      if (!res.ok) {
        if (!opts?.silent) setError("Could not load messages");
        return;
      }
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setError(null);
    } catch {
      if (!opts?.silent) setError("Could not load messages");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load({ silent: true }), 15_000);
    const onRead = () => void load({ silent: true });
    window.addEventListener("tech-field-messages-read", onRead);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("tech-field-messages-read", onRead);
    };
  }, [load]);

  return (
    <TechAppShell activeTab="messages">
      <div className="mb-4">
        <h1 className="text-lg font-extrabold text-navy">Messages</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Dispatch notes on your jobs. Open a job to read and reply.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[#9aa0a6]" role="status">
          Loading inbox…
        </p>
      ) : error ? (
        <div className="rounded-[14px] border border-[#fdecec] bg-white px-4 py-5">
          <p className="text-sm text-[#b3261e]" role="alert">
            {error}
          </p>
          <button
            type="button"
            className="mt-3 text-sm font-bold text-[#0a7a63]"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center rounded-[14px] border border-[#e3e7ed] bg-white px-6 py-14 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-[#eafaf5] text-[#0a7a63]">
            <MessageSquare className="size-6" aria-hidden />
          </div>
          <p className="text-sm font-bold text-navy">No unread dispatch messages</p>
          <p className="mt-2 max-w-sm text-sm text-[#6b7280]">
            When ops sends a field note on one of your jobs, it shows up here
            until you open that job.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.jobId}>
              <Link
                href={`/tech/job/${item.jobId}`}
                className="block rounded-[14px] border border-[#e3e7ed] bg-white px-4 py-3.5 transition-colors hover:border-[#0a7a63]/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full bg-[#d64545]" aria-hidden />
                      <p className="truncate text-sm font-extrabold text-navy">
                        {item.customerName}
                      </p>
                    </div>
                    <p className="mt-1 truncate text-xs text-[#9aa0a6]">
                      {item.jobId}
                      {item.suburb ? ` · ${item.suburb}` : ""}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-[#32373c]">
                      {item.preview}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-bold text-[#9aa0a6]">
                    {formatInboxWhen(item.latestAt)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </TechAppShell>
  );
}
