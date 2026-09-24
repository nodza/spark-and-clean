"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { TechAppShell } from "@/components/layout/TechAppShell";
import { Button } from "@/components/ui/button";

/**
 * Guarded placeholder — session + role enforced by middleware, layout, and shell.
 * Chat product UI lands in a later ticket.
 */
export default function TechMessagesPage() {
  return (
    <TechAppShell activeTab="today">
      <div className="flex flex-col items-center rounded-[14px] border border-[#e3e7ed] bg-white px-6 py-14 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-[#eafaf5] text-[#0a7a63]">
          <MessageSquare className="size-6" aria-hidden />
        </div>
        <h1 className="text-lg font-extrabold text-navy">Messages</h1>
        <p className="mt-2 max-w-sm text-sm text-[#6b7280]">
          Dispatch chat is coming soon. Your jobs stay on the Today tab.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link href="/tech/dashboard">Back to Today</Link>
        </Button>
      </div>
    </TechAppShell>
  );
}
