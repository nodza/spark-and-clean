"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, MapPin } from "lucide-react";
import { TechAppShell } from "@/components/layout/TechAppShell";
import { Button } from "@/components/ui/button";
import { useAuth, useRequireAuth } from "@/hooks/useRequireClientAuth";

/** Session identity + real logout (clears sc_session cookie). */
export default function TechProfilePage() {
  const router = useRouter();
  const { logout } = useAuth();
  const { user } = useRequireAuth(["technician"], "/tech/login");

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/tech/login");
  }, [logout, router]);

  return (
    <TechAppShell activeTab="profile">
      <h1 className="text-[22px] font-extrabold tracking-tight text-navy">
        Profile
      </h1>
      <p className="mt-1.5 text-[13.5px] text-[#6b7280]">
        Signed in with your technician session.
      </p>

      <div className="mt-5 rounded-[14px] border border-[#e3e7ed] bg-white p-[18px]">
        <div className="text-[10.5px] font-extrabold tracking-[0.13em] text-[#9aa0a6]">
          ACCOUNT
        </div>
        <div className="mt-2 text-base font-bold text-navy">
          {user?.name || "Technician"}
        </div>
        <div className="mt-1 text-sm text-[#6b7280]">{user?.email}</div>
        {user?.driverProfileId ? (
          <div className="mt-3 text-xs text-[#9aa0a6]">
            Driver id · {user.driverProfileId}
          </div>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        <Link
          href="/tech/map"
          className="flex items-center gap-3 rounded-xl border border-[#e3e7ed] bg-white px-4 py-3.5 text-sm font-bold text-navy"
        >
          <MapPin className="size-4 text-[#0a7a63]" aria-hidden />
          Route map
        </Link>
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-6 h-12 w-full border-[#e3e7ed] font-bold text-navy"
        onClick={() => void handleLogout()}
      >
        <LogOut className="size-4" aria-hidden />
        Log out
      </Button>
    </TechAppShell>
  );
}
