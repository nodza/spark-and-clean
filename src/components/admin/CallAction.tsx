import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { telHref } from "@/lib/phone";
import { cn } from "@/lib/utils";

export { driverProfileHref } from "@/lib/phone";

type CallActionProps = {
  label: string;
  phone?: string;
  disabledReason?: string;
  /** Prefer `/admin/drivers/{profileId}` so the existing redirect canonicalizes to User id. */
  profileHref?: string;
  /** Icon-only control for dense tables. */
  compact?: boolean;
  /**
   * `button` — bordered secondary control (cards / sidebars).
   * `inline` — quiet green text action beside existing phone text.
   */
  appearance?: "button" | "inline";
};

export function CallAction({
  label,
  phone,
  disabledReason,
  profileHref,
  compact = false,
  appearance = "button",
}: CallActionProps) {
  const trimmed = phone?.trim();
  const visibleLabel = appearance === "inline" ? "Call" : label;

  if (trimmed) {
    if (compact) {
      return (
        <Button
          asChild
          variant="secondary"
          size="icon-sm"
          className="size-8 shrink-0 rounded-full border-[#e3e7ed] bg-white text-[#0a7a63] shadow-none hover:border-[#0a7a63]/hover:bg-[#f7f9fb] hover:text-[#000b49]"
        >
          <a
            href={telHref(trimmed)}
            onClick={(event) => event.stopPropagation()}
            aria-label={label}
            title={label}
          >
            <Phone className="size-3.5" strokeWidth={2} aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </a>
        </Button>
      );
    }

    if (appearance === "inline") {
      return (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-auto gap-1 px-1.5 py-0.5 text-[12.5px] font-extrabold text-[#0a7a63] hover:bg-transparent hover:text-[#000b49]"
        >
          <a
            href={telHref(trimmed)}
            onClick={(event) => event.stopPropagation()}
            aria-label={label}
          >
            <Phone className="size-3.5" strokeWidth={2} aria-hidden="true" />
            {visibleLabel}
          </a>
        </Button>
      );
    }

    return (
      <Button
        asChild
        variant="secondary"
        size="sm"
        className="h-9 gap-2 rounded-full px-4 text-[13px] font-extrabold shadow-none"
      >
        <a
          href={telHref(trimmed)}
          onClick={(event) => event.stopPropagation()}
          aria-label={label}
        >
          <Phone className="size-3.5" strokeWidth={2} aria-hidden="true" />
          {visibleLabel}
        </a>
      </Button>
    );
  }

  if (compact) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        disabled
        title={disabledReason}
        aria-label={disabledReason ? `${label}: ${disabledReason}` : label}
        className="size-8 shrink-0 cursor-not-allowed rounded-full border-[#e3e7ed] bg-[#f7f9fb] text-[#9aa0a6] opacity-100 shadow-none"
        onClick={(event) => event.stopPropagation()}
      >
        <Phone className="size-3.5" strokeWidth={2} aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button
        type="button"
        variant={appearance === "inline" ? "ghost" : "secondary"}
        size="sm"
        disabled
        title={disabledReason}
        aria-label={disabledReason ? `${label}: ${disabledReason}` : label}
        className={cn(
          "cursor-not-allowed opacity-100 shadow-none",
          appearance === "inline"
            ? "h-auto gap-1 px-1.5 py-0.5 text-[12.5px] font-extrabold text-[#9aa0a6] hover:bg-transparent"
            : "h-9 gap-2 rounded-full border-[#e3e7ed] bg-[#f7f9fb] px-4 text-[13px] font-extrabold text-[#9aa0a6]"
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <Phone className="size-3.5" strokeWidth={2} aria-hidden="true" />
        {appearance === "inline" ? "Call" : label}
      </Button>
      {disabledReason ? (
        <span className="text-meta text-[#9aa0a6]">{disabledReason}</span>
      ) : null}
      {profileHref ? (
        <a
          href={profileHref}
          onClick={(event) => event.stopPropagation()}
          className="text-meta font-extrabold text-[#0a7a63] underline-offset-2 hover:underline hover:text-[#000b49]"
        >
          Open profile
        </a>
      ) : null}
    </div>
  );
}
