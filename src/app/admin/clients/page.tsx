"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import {
  AdminPortalShell,
  AdminSearchTopbar,
} from "@/components/admin/AdminPortalShell";
import {
  applyListPaginationParams,
  parseListPagination,
  type ListPagination,
  type PageSize,
} from "@/lib/listPagination";

type ClientRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  inactive: boolean;
};

const TABLE_COLS = "minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.5fr) minmax(0,0.8fr) 6.5rem";
const HEADINGS = ["Name", "Phone", "Email", "City", "Status"] as const;

function listHref(query: string, pagination: ListPagination) {
  const params = applyListPaginationParams(new URLSearchParams(), pagination);
  const q = query.trim();
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/admin/clients?${qs}` : "/admin/clients";
}

export default function AdminClientsPage() {
  return (
    <Suspense fallback={<ClientsShellFallback />}>
      <AdminClientsList />
    </Suspense>
  );
}

function ClientsShellFallback() {
  return (
    <AdminPortalShell
      pageTitle="Clients"
      active="clients"
      topbarActions={<AdminSearchTopbar searchPlaceholder="Search by name, phone, or email" />}
    >
      <div className="portal-page text-meta" style={{ color: "#9aa0a6" }}>
        Loading clients…
      </div>
    </AdminPortalShell>
  );
}

function AdminClientsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const pagination = useMemo(
    () => parseListPagination(searchParams),
    [searchParams]
  );
  const page = pagination.page;
  const limit = pagination.limit;

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    const q = query.trim();
    if (q) params.set("q", q);
    applyListPaginationParams(params, { page, limit });
    const qs = params.toString();

    setClients([]);
    setTotal(0);
    setLoading(true);
    setLoadError(null);

    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/clients${qs ? `?${qs}` : ""}`,
          {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          clients?: ClientRow[];
          total?: number;
        };
        if (!res.ok) {
          throw new Error(data.error || "Could not load clients");
        }
        if (controller.signal.aborted) return;
        setClients(Array.isArray(data.clients) ? data.clients : []);
        setTotal(typeof data.total === "number" ? data.total : 0);
        setLoading(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        setLoadError(
          err instanceof Error ? err.message : "Could not load clients"
        );
        setClients([]);
        setTotal(0);
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [query, page, limit, reloadKey]);

  function writeListUrl(nextQuery: string, next: ListPagination) {
    router.replace(listHref(nextQuery, next), { scroll: false });
  }

  function setSearch(next: string) {
    writeListUrl(next, { page: 1, limit });
  }

  function setPage(nextPage: number) {
    writeListUrl(query, { page: nextPage, limit });
  }

  function setLimit(limit: PageSize) {
    writeListUrl(query, { page: 1, limit });
  }

  const showEmpty = !loading && !loadError && total === 0 && !query.trim();
  const showNoMatch = !loading && !loadError && total === 0 && Boolean(query.trim());

  return (
    <AdminPortalShell
      pageTitle="Clients"
      active="clients"
      topbarActions={
        <AdminSearchTopbar
          searchValue={query}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name, phone, or email"
        />
      }
    >
      <div className="portal-page flex flex-col gap-[18px]">
        <div>
          <div
            className="flex items-center gap-2 text-eyebrow"
            style={{ color: "#9aa0a6" }}
          >
            <Users size={14} strokeWidth={1.8} aria-hidden="true" />
            Client accounts
          </div>
          <p className="text-meta mt-[6px]" style={{ color: "#9aa0a6" }}>
            Every person with a client account, including accounts that are switched off.
          </p>
        </div>

        {loadError ? (
          <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
            {loadError}{" "}
            <button
              type="button"
              className="ds-text-action"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Try again
            </button>
          </p>
        ) : null}

        <div className="ds-card overflow-hidden p-0">
          <div className="hidden lg:block">
            <div
              className="grid items-center px-[22px] py-[14px]"
              style={{
                gridTemplateColumns: TABLE_COLS,
                background: "#f7f9fb",
                borderBottom: "1px solid #f0f2f6",
                columnGap: 10,
              }}
            >
              {HEADINGS.map((heading) => (
                <div key={heading} className="text-th whitespace-nowrap">
                  {heading}
                </div>
              ))}
            </div>
            {clients.map((client) => (
              <div
                key={client.id}
                className="grid items-center px-[22px] py-[12px]"
                style={{
                  gridTemplateColumns: TABLE_COLS,
                  borderBottom: "1px solid #f0f2f6",
                  columnGap: 10,
                }}
              >
                <Cell value={client.name} emphasis />
                <Cell value={client.phone} />
                <Cell value={client.email} />
                <Cell value={client.city} />
                <StatusPill inactive={client.inactive} />
              </div>
            ))}
          </div>

          <div className="lg:hidden">
            {clients.map((client) => (
              <div
                key={client.id}
                className="border-b border-[#f0f2f6] px-[16px] py-[14px]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="min-w-0 truncate text-[15px] font-bold"
                    style={{ color: "#000b49" }}
                  >
                    {client.name}
                  </div>
                  <StatusPill inactive={client.inactive} />
                </div>
                <div className="text-body mt-[4px] break-all" style={{ color: "#32373c" }}>
                  {client.email}
                </div>
                {client.phone || client.city ? (
                  <div className="text-meta mt-[4px]" style={{ color: "#9aa0a6" }}>
                    {[client.phone, client.city].filter(Boolean).join(" · ")}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {loading ? (
            <div
              className="px-[22px] py-[40px] text-center text-meta"
              style={{ color: "#9aa0a6" }}
              role="status"
            >
              Loading clients…
            </div>
          ) : null}

          {showEmpty ? (
            <div
              className="px-[22px] py-[40px] text-center text-meta"
              style={{ color: "#9aa0a6" }}
            >
              No clients yet.
            </div>
          ) : null}

          {showNoMatch ? (
            <div
              className="px-[22px] py-[40px] text-center text-meta"
              style={{ color: "#9aa0a6" }}
            >
              No clients match “{query.trim()}”.
            </div>
          ) : null}

          <AdminListPagination
            total={total}
            page={page}
            limit={limit}
            shownCount={clients.length}
            onPageChange={setPage}
            onLimitChange={setLimit}
            pageSizeLabel="Per page"
          />
        </div>
      </div>
    </AdminPortalShell>
  );
}

function Cell({ value, emphasis = false }: { value: string; emphasis?: boolean }) {
  return (
    <div
      className={`min-w-0 truncate text-body ${emphasis ? "font-bold" : ""}`}
      style={{ color: emphasis ? "#000b49" : "#32373c" }}
      title={value || undefined}
    >
      {value}
    </div>
  );
}

function StatusPill({ inactive }: { inactive: boolean }) {
  if (!inactive) {
    return (
      <span
        className="inline-flex w-fit whitespace-nowrap rounded-full px-2 py-[5px] text-[10px] font-extrabold"
        style={{ background: "#eafaf5", color: "#0a7a63" }}
      >
        ACTIVE
      </span>
    );
  }
  return (
    <span
      className="inline-flex w-fit whitespace-nowrap rounded-full px-2 py-[5px] text-[10px] font-extrabold"
      style={{ background: "#fdecec", color: "#b33232" }}
    >
      INACTIVE
    </span>
  );
}
