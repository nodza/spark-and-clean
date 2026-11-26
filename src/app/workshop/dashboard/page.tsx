"use client";

import { useState } from "react";
import { Check, LoaderCircle, PackageCheck, Search } from "lucide-react";
import { bookingAddOnLabels, OPS_ADD_ON_COPY, rugDimensionLabel } from "@/lib/techUi";
import type {
  WorkshopActivityAction,
  WorkshopActivityEntry,
} from "@/types/workshop";

type InternalNote = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
};

type WorkshopRug = {
  bookingId: string;
  tagCode: string;
  type: string;
  widthM: number | null;
  lengthM: number | null;
  areaSqM: number | null;
  addOns: {
    odourRemoval?: boolean;
    stainProtection?: boolean;
    stainTreatment?: boolean;
    fabricProtection?: boolean;
  };
  notes: InternalNote[];
};

type LookupState = "idle" | "loading" | "ready" | "error";

function activityLabel(action: WorkshopActivityAction) {
  return action === "RECEIVED" ? "Received at workshop" : "Cleaning completed";
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-ZA", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Johannesburg",
      }).format(date);
}

export default function WorkshopDashboardPage() {
  const [query, setQuery] = useState("");
  const [rug, setRug] = useState<WorkshopRug | null>(null);
  const [activity, setActivity] = useState<WorkshopActivityEntry[]>([]);
  const [state, setState] = useState<LookupState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [savingAction, setSavingAction] =
    useState<WorkshopActivityAction | null>(null);

  const lookup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const tagCode = query.trim().toUpperCase();
    if (!tagCode) return;

    setState("loading");
    setError(null);
    setRug(null);
    setActivity([]);
    try {
      const response = await fetch(
        `/api/workshop/rugs/${encodeURIComponent(tagCode)}`,
        { credentials: "include", cache: "no-store" }
      );
      const data = (await response.json()) as {
        error?: string;
        rug?: WorkshopRug;
        activity?: WorkshopActivityEntry[];
      };
      if (!response.ok || !data.rug) {
        setError(data.error || "Could not find a rug with that tag.");
        setState("error");
        return;
      }
      setRug(data.rug);
      setActivity(Array.isArray(data.activity) ? data.activity : []);
      setQuery(data.rug.tagCode);
      setState("ready");
    } catch {
      setError("Could not search for that rug. Please try again.");
      setState("error");
    }
  };

  const recordActivity = async (action: WorkshopActivityAction) => {
    if (!rug || savingAction) return;
    setSavingAction(action);
    setError(null);
    try {
      const response = await fetch(
        `/api/workshop/rugs/${encodeURIComponent(rug.tagCode)}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const data = (await response.json()) as {
        error?: string;
        activity?: WorkshopActivityEntry;
      };
      if (!response.ok || !data.activity) {
        setError(data.error || "Could not record this activity.");
        return;
      }
      setActivity((entries) => [data.activity!, ...entries]);
    } catch {
      setError("Could not record this activity. Please try again.");
    } finally {
      setSavingAction(null);
    }
  };

  const addOns = bookingAddOnLabels(rug?.addOns, OPS_ADD_ON_COPY);
  const dimensions = rug
    ? rugDimensionLabel({
        widthM: rug.widthM,
        lengthM: rug.lengthM,
        areaSqM: rug.areaSqM ?? 0,
      })
    : "";

  return (
    <main className="mx-auto w-full max-w-[920px] px-4 py-8 sm:px-6">
      <header className="border-b border-[#e7e9ec] pb-5">
        <p className="text-xs font-bold uppercase tracking-wide text-[#0a7a63]">
          Workshop intake
        </p>
        <h1 className="mt-2 text-[26px] font-extrabold leading-tight text-[#000b49]">
          Rug lookup
        </h1>
        <p className="mt-1 text-sm text-[#697078]">
          Scan or enter a rug tag to view cleaning details and record who
          received or cleaned it.
        </p>
        <form onSubmit={(event) => void lookup(event)} className="mt-5 flex gap-2">
          <label htmlFor="workshop-tag" className="sr-only">
            Rug tag code
          </label>
          <input
            id="workshop-tag"
            type="search"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value.toUpperCase())}
            placeholder="Enter or scan tag code"
            className="h-12 min-w-0 flex-1 rounded-[7px] border border-[#cfd5d8] bg-white px-3.5 font-mono text-[15px] text-[#20252a] outline-none placeholder:font-sans placeholder:text-[#92999e] focus:border-[#0a7a63] focus:ring-2 focus:ring-[#0a7a63]/15"
          />
          <button
            type="submit"
            disabled={state === "loading" || !query.trim()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[7px] bg-[#000b49] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state === "loading" ? (
              <LoaderCircle size={17} className="animate-spin" aria-hidden />
            ) : (
              <Search size={17} aria-hidden />
            )}
            Search
          </button>
        </form>
      </header>

      {state === "idle" ? (
        <p className="py-6 text-sm text-[#737b80]">
          Enter a rug tag to view its cleaning information.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-5 text-sm font-semibold text-[#a33030]">
          {error}
        </p>
      ) : null}

      {rug ? (
        <div className="mt-6 space-y-5">
          <section className="rounded-xl border border-[#e7e9ec] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase text-[#7b8388]">
                  Rug tag
                </p>
                <p className="mt-1 break-all font-mono text-lg font-bold text-[#000b49]">
                  {rug.tagCode}
                </p>
              </div>
              <p className="text-sm text-[#697078]">
                Booking <span className="font-mono font-semibold">{rug.bookingId}</span>
              </p>
            </div>
            <dl className="mt-5 grid gap-4 border-t border-[#f0f2f6] pt-4 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-bold uppercase text-[#7b8388]">
                  Rug type
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[#20252a]">
                  {rug.type}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase text-[#7b8388]">
                  Dimensions
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[#20252a]">
                  {dimensions}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-bold uppercase text-[#7b8388]">
                  Add-ons
                </dt>
                <dd className="mt-1 text-sm text-[#20252a]">
                  {addOns.length ? addOns.join(", ") : "None"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-[#e7e9ec] bg-white p-5">
            <h2 className="text-base font-extrabold text-[#000b49]">
              Internal notes
            </h2>
            {rug.notes.length ? (
              <ul className="mt-3 space-y-3">
                {rug.notes.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-lg bg-[#f7f9fb] px-3 py-3"
                  >
                    <p className="whitespace-pre-wrap text-sm text-[#32373c]">
                      {note.body}
                    </p>
                    <p className="mt-2 text-xs text-[#8b9297]">
                      {note.author} · {formatTime(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[#8b9297]">No internal notes.</p>
            )}
          </section>

          <section className="rounded-xl border border-[#e7e9ec] bg-white p-5">
            <h2 className="text-base font-extrabold text-[#000b49]">
              Record workshop activity
            </h2>
            <p className="mt-1 text-sm text-[#697078]">
              Each entry records your individual account and the server time.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={savingAction !== null}
                onClick={() => void recordActivity("RECEIVED")}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#000b49] px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {savingAction === "RECEIVED" ? (
                  <LoaderCircle size={16} className="animate-spin" aria-hidden />
                ) : (
                  <PackageCheck size={16} aria-hidden />
                )}
                Record received
              </button>
              <button
                type="button"
                disabled={savingAction !== null}
                onClick={() => void recordActivity("CLEANED")}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#0a7a63] px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {savingAction === "CLEANED" ? (
                  <LoaderCircle size={16} className="animate-spin" aria-hidden />
                ) : (
                  <Check size={16} aria-hidden />
                )}
                Record cleaning completed
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-[#e7e9ec] bg-white p-5">
            <h2 className="text-base font-extrabold text-[#000b49]">
              Activity history
            </h2>
            {activity.length ? (
              <ol className="mt-3 divide-y divide-[#f0f2f6]">
                {activity.map((entry) => (
                  <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-bold text-[#20252a]">
                      {activityLabel(entry.action)}
                    </p>
                    <p className="mt-1 text-sm text-[#555e64]">
                      {entry.actorName} ({entry.actorEmail})
                    </p>
                    <p className="mt-1 text-xs text-[#8b9297]">
                      {formatTime(entry.occurredAt)} · Booking {entry.bookingId}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-[#8b9297]">
                No workshop activity recorded yet.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
