"use client";

import {
  AdminPortalShell,
  AdminSearchTopbar,
} from "@/components/admin/AdminPortalShell";

export default function AdminClientsPage() {
  return (
    <AdminPortalShell
      pageTitle="Clients"
      active="clients"
      topbarActions={<AdminSearchTopbar searchPlaceholder="Search clients" />}
    >
      <div className="portal-page">
        <div className="ds-card max-w-lg">
          <div
            className="text-[18px] font-extrabold"
            style={{ color: "#000b49" }}
          >
            Clients
          </div>
          <p className="text-meta mt-[8px]" style={{ color: "#9aa0a6" }}>
            A full client directory hasn’t shipped yet. Customer name, phone,
            and address are still on each booking.
          </p>
        </div>
      </div>
    </AdminPortalShell>
  );
}
