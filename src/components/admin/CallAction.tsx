import { Phone } from "lucide-react";
import { telHref } from "@/lib/phone";

type CallActionProps = {
  label: string;
  phone?: string;
  disabledReason?: string;
  profileHref?: string;
};

export function CallAction({
  label,
  phone,
  disabledReason,
  profileHref,
}: CallActionProps) {
  if (phone?.trim()) {
    return (
      <a
        href={telHref(phone)}
        onClick={(event) => event.stopPropagation()}
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-[#000b49] px-3 text-sm font-bold text-white hover:bg-[#0a1a6b]"
      >
        <Phone className="h-4 w-4" aria-hidden="true" />
        {label}
      </a>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled
        title={disabledReason}
        className="inline-flex min-h-9 cursor-not-allowed items-center justify-center gap-2 rounded-md bg-[#e3e7ed] px-3 text-sm font-bold text-[#6b7280]"
      >
        <Phone className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
      <span className="text-xs text-[#6b7280]">{disabledReason}</span>
      {profileHref ? (
        <a
          href={profileHref}
          onClick={(event) => event.stopPropagation()}
          className="text-xs font-bold text-[#0a7a63] hover:underline"
        >
          Open profile
        </a>
      ) : null}
    </div>
  );
}
