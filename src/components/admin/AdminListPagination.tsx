"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PAGE_SIZE_OPTIONS,
  type PageSize,
} from "@/lib/listPagination";

function PaginationButton({
  ariaLabel,
  disabled,
  onClick,
  children,
}: {
  ariaLabel: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-[9px] transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000b49]",
        disabled
          ? "cursor-not-allowed text-[#c5cad3]"
          : "text-[#000b49] hover:bg-[#f0f2f6] active:bg-[#e8ebf0]"
      )}
    >
      {children}
    </button>
  );
}

export function AdminListPagination({
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  shownCount,
  pageSizeLabel = "Per page",
}: {
  total: number;
  page: number;
  limit: PageSize;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: PageSize) => void;
  pageSizeOptions?: readonly PageSize[];
  /** Rows currently visible; defaults to the page window size. */
  shownCount?: number;
  pageSizeLabel?: string;
}) {
  if (total <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const visible =
    shownCount ??
    Math.min(limit, Math.max(0, total - (safePage - 1) * limit));

  return (
    <div
      className="flex flex-col gap-3 px-[16px] py-[14px] sm:px-[22px] lg:grid lg:items-center"
      style={{
        gridTemplateColumns: "1fr auto 1fr",
        borderTop: "1px solid #f0f2f6",
        background: "#fbfcfd",
      }}
    >
      <p
        className="text-[13px] font-medium tabular-nums lg:justify-self-start"
        style={{ color: "#6b7280" }}
        aria-live="polite"
      >
        Showing{" "}
        <span className="font-bold text-[#000b49]">{visible}</span> of{" "}
        <span className="font-bold text-[#000b49]">{total}</span>
      </p>

      <div
        className="flex items-center justify-center gap-1"
        role="navigation"
        aria-label="Pagination"
      >
        <PaginationButton
          ariaLabel="First page"
          disabled={safePage <= 1}
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft size={16} strokeWidth={2.2} />
        </PaginationButton>
        <PaginationButton
          ariaLabel="Previous page"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
        >
          <ChevronLeft size={16} strokeWidth={2.2} />
        </PaginationButton>
        <span
          className="mx-2 min-w-[4.5rem] text-center text-[12px] font-bold tabular-nums"
          style={{ color: "#000b49" }}
        >
          {safePage} / {totalPages}
        </span>
        <PaginationButton
          ariaLabel="Next page"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
        >
          <ChevronRight size={16} strokeWidth={2.2} />
        </PaginationButton>
        <PaginationButton
          ariaLabel="Last page"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          <ChevronsRight size={16} strokeWidth={2.2} />
        </PaginationButton>
      </div>

      <label className="flex items-center justify-end gap-2 lg:justify-self-end">
        <span
          className="hidden text-[12px] font-semibold sm:inline"
          style={{ color: "#9aa0a6" }}
        >
          {pageSizeLabel}
        </span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value) as PageSize)}
          aria-label={pageSizeLabel}
          className="min-h-10 rounded-[9px] border border-[#e3e7ed] bg-white px-3 text-[13px] font-bold text-[#000b49] outline-none transition-shadow focus:border-[#6cf3d5] focus:shadow-[0_0_0_3px_rgba(108,243,213,0.25)]"
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
