"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, LoaderCircle, Search, Tag } from "lucide-react";
import { AdminPortalShell } from "@/components/admin/AdminPortalShell";

type RugSearchResult = {
  tagCode: string;
  customer: string;
  bookingId: string;
  status: string;
  thumbnails: string[];
};

type SearchState = "idle" | "loading" | "empty" | "success" | "error";

export default function AdminRugsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RugSearchResult[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const abortRef = useRef<AbortController | null>(null);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tagCode = query.trim();
    if (!tagCode) {
      abortRef.current?.abort();
      setResults([]);
      setState("idle");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState("loading");
    try {
      const response = await fetch(`/api/rugs?q=${encodeURIComponent(tagCode)}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Search failed");
      const payload = (await response.json()) as { results?: RugSearchResult[] };
      if (controller.signal.aborted) return;
      const matches = payload.results ?? [];
      setResults(matches);
      setState(matches.length ? "success" : "empty");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setResults([]);
      setState("error");
    }
  }

  return (
    <AdminPortalShell active="rugs">
      <main className="portal-page mx-auto w-full max-w-[1120px]">
        <div className="border-b border-[#e7e9ec] pb-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#0a7a63]">
            <Tag size={15} aria-hidden />
            Depot lookup
          </div>
          <h1 className="mt-2 text-[26px] font-extrabold leading-tight text-[#000b49]">
            Find a rug by tag
          </h1>
          <p className="mt-1 text-sm text-[#697078]">
            Search by the code on the rug label.
          </p>
          <form onSubmit={search} className="mt-5 flex max-w-[720px] gap-2">
            <label htmlFor="rug-tag-search" className="sr-only">
              Rug tag code
            </label>
            <input
              id="rug-tag-search"
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
              className="inline-flex h-12 flex-none items-center justify-center gap-2 rounded-[7px] bg-[#000b49] px-4 text-sm font-bold text-white transition-colors hover:bg-[#102267] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a7a63] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === "loading" ? (
                <LoaderCircle size={17} className="animate-spin" aria-hidden />
              ) : (
                <Search size={17} aria-hidden />
              )}
              Search
            </button>
          </form>
        </div>

        <section aria-live="polite" className="pt-5">
          {state === "idle" ? (
            <p className="text-sm text-[#737b80]">Enter a rug tag to find its booking.</p>
          ) : null}
          {state === "loading" ? (
            <p className="text-sm text-[#737b80]">Searching tags…</p>
          ) : null}
          {state === "empty" ? (
            <div className="border-l-[3px] border-[#d8a72e] py-2 pl-3">
              <p className="text-sm font-bold text-[#32373c]">No rug found</p>
              <p className="mt-1 text-sm text-[#737b80]">Check the tag code and try again.</p>
            </div>
          ) : null}
          {state === "error" ? (
            <p role="alert" className="text-sm font-semibold text-[#a33030]">
              Search could not be completed. Try again.
            </p>
          ) : null}
          {state === "success" ? (
            <ul className="divide-y divide-[#e7e9ec] border-y border-[#e7e9ec]">
              {results.map((result) => (
                <li key={`${result.tagCode}-${result.bookingId}`}>
                  <Link
                    href={`/admin/bookings/${encodeURIComponent(result.bookingId)}`}
                    className="group flex min-w-0 flex-col gap-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0a7a63] sm:flex-row sm:items-center"
                  >
                    <div className="flex shrink-0 gap-2">
                      {result.thumbnails.slice(0, 3).map((src, index) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={`${src}-${index}`}
                          src={src}
                          alt={`Rug photo ${index + 1}`}
                          className="size-[68px] rounded-[5px] border border-[#e1e4e6] bg-[#f1f3f3] object-cover"
                        />
                      ))}
                      {result.thumbnails.length === 0 ? (
                        <div className="flex size-[68px] items-center justify-center rounded-[5px] border border-[#e1e4e6] bg-[#f1f3f3] text-[#7b8388]">
                          <Tag size={21} aria-hidden />
                        </div>
                      ) : null}
                    </div>
                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(130px,1fr)_minmax(130px,1fr)_110px] sm:items-center">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase text-[#7b8388]">Tag</p>
                        <p className="mt-1 break-all font-mono text-sm font-bold text-[#20252a]">
                          {result.tagCode}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase text-[#7b8388]">Customer</p>
                        <p className="mt-1 truncate text-sm font-semibold text-[#32373c]">
                          {result.customer}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:block">
                        <div>
                          <p className="text-[11px] font-bold uppercase text-[#7b8388]">Booking</p>
                          <p className="mt-1 text-sm font-semibold text-[#32373c]">{result.bookingId}</p>
                        </div>
                        <span className="rounded-[4px] bg-[#eaf5f1] px-2 py-1 text-[11px] font-bold text-[#08735e]">
                          {result.status.replaceAll("_", " ")}
                        </span>
                      </div>
                    </div>
                    <ArrowUpRight
                      size={18}
                      className="hidden shrink-0 text-[#7b8388] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:block"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>
    </AdminPortalShell>
  );
}