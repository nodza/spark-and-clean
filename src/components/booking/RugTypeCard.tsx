"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type RugTypeCardProps = {
  title: string;
  description: string;
  imageUrl: string;
  fromPrice: number;
  selected?: boolean;
  onSelect: () => void;
};

export function RugTypeCard({
  title,
  description,
  imageUrl,
  fromPrice,
  selected = false,
  onSelect,
}: RugTypeCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${title}, from R${fromPrice}. ${description}`}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-xl border-2 bg-card text-left transition-all",
        "hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary shadow-md ring-2 ring-primary/20"
          : "border-border"
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary/30">
        <Image
          src={imageUrl}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 768px) 50vw, 200px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {selected && (
          <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
            <Check className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="text-sm font-semibold leading-snug text-foreground">
          {title}
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
        <span className="mt-auto pt-1 text-[11px] font-semibold text-[#6b7280]">
          from R{fromPrice}
        </span>
      </div>
    </button>
  );
}
