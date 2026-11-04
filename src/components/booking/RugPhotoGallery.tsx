"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { isDisplayablePhotoUrl } from "@/lib/techUi";

/** Path of a photo URL. A new signed link for the same object keeps this id. */
export function photoIdentity(url: string): string {
  try {
    return decodeURIComponent(new URL(url, "http://localhost").pathname);
  } catch {
    return url;
  }
}

type StablePhoto = { id: string; src: string };

function useStablePhotos(urls: string[]) {
  const cache = useRef(new Map<string, string>());
  const broken = useRef(new Set<string>());
  const [, bump] = useState(0);

  const photos: StablePhoto[] = urls.map((url) => {
    const id = photoIdentity(url);
    if (!cache.current.has(id)) cache.current.set(id, url);
    return { id, src: cache.current.get(id) ?? url };
  });

  const seen = new Set(photos.map((photo) => photo.id));
  for (const id of cache.current.keys()) {
    if (!seen.has(id)) {
      cache.current.delete(id);
      broken.current.delete(id);
    }
  }

  useEffect(() => {
    let changed = false;
    for (const id of broken.current) {
      const latest = urls.find((url) => photoIdentity(url) === id);
      if (latest && latest !== cache.current.get(id)) {
        cache.current.set(id, latest);
        broken.current.delete(id);
        changed = true;
      }
    }
    if (changed) bump((count) => count + 1);
  }, [urls]);

  function noteBroken(id: string) {
    broken.current.add(id);
    const latest = urls.find((url) => photoIdentity(url) === id);
    if (latest && latest !== cache.current.get(id)) {
      cache.current.set(id, latest);
      broken.current.delete(id);
      bump((count) => count + 1);
    }
  }

  return { photos, noteBroken };
}

export function RugPhotoGallery({
  title,
  photos,
  label,
}: {
  title: string;
  photos?: string[];
  label?: string;
}) {
  const visible = (photos ?? []).filter(isDisplayablePhotoUrl);
  const { photos: stable, noteBroken } = useStablePhotos(visible);
  const [openAt, setOpenAt] = useState<number | null>(null);
  const open = openAt != null ? stable[openAt] : undefined;

  if (stable.length === 0) return null;

  function step(direction: -1 | 1) {
    setOpenAt((current) => {
      if (current == null) return current;
      return (current + direction + stable.length) % stable.length;
    });
  }

  return (
    <div>
      {label ? (
        <div className="mb-1.5 text-[11px] font-bold text-[#6b7280]">{label}</div>
      ) : null}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stable.map((photo, index) => (
          <li key={photo.id} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.src}
              alt={`${title} ${index + 1}`}
              className="h-28 w-full rounded-[10px] border border-[#f0f2f6] object-cover sm:h-32"
              onError={() => noteBroken(photo.id)}
            />
            <button
              type="button"
              aria-label={`View ${title} ${index + 1}`}
              onClick={() => setOpenAt(index)}
              className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Eye className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <Dialog
        open={open != null}
        onOpenChange={(next) => {
          if (!next) setOpenAt(null);
        }}
      >
        <DialogContent className="w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] gap-3 bg-white p-3 sm:max-w-5xl sm:p-4">
          <DialogTitle className="pr-8 text-base text-[#000b49]">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {openAt != null
              ? `Photo ${openAt + 1} of ${stable.length}`
              : "Photo preview"}
          </DialogDescription>
          {open ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={open.src}
              alt={`${title} ${openAt != null ? openAt + 1 : 1}`}
              className="mx-auto max-h-[calc(100vh-8rem)] w-full object-contain"
            />
          ) : null}
          {stable.length > 1 && openAt != null ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => step(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e3e7ed] text-[#000b49] hover:bg-[#f5f7fa]"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <p className="text-sm font-medium text-[#6b7280]">
                {openAt + 1} / {stable.length}
              </p>
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => step(1)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e3e7ed] text-[#000b49] hover:bg-[#f5f7fa]"
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
