"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Booking, RugDetails } from "@/types/booking";
import { isRugPhotoKey, RUG_PHOTO_MAX_BYTES, RUG_PHOTO_MAX_LABEL } from "@/lib/rugPhotos";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, Upload, X } from "lucide-react";

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
  onUploadGateChange?: (gate: { busy: boolean; failed: boolean }) => void;
}

type PhotoStatus = "uploading" | "ready" | "error";

type PhotoItem = {
  id: string;
  previewUrl: string;
  key: string | null;
  file: File | null;
  status: PhotoStatus;
  progress: number;
  error: string | null;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const ACCEPT_ATTR = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

const previewByKey = new Map<string, string>();
const activeUploads = new Map<string, XMLHttpRequest>();
const cancelledUploads = new Set<string>();

function emptyRug(): RugDetails {
  return { type: "", widthM: 0, lengthM: 0, areaSqM: 0, photos: [], labelPhotos: [] };
}

function readyKeys(items: PhotoItem[]) {
  return items.flatMap((item) =>
    item.status === "ready" && item.key ? [item.key] : []
  );
}

function fromStored(values: string[] | undefined): PhotoItem[] {
  return (values ?? []).filter(isRugPhotoKey).map((key) => ({
    id: key,
    key,
    previewUrl: previewByKey.get(key) ?? "",
    file: null,
    status: "ready" as const,
    progress: 100,
    error: null,
  }));
}

function putPhoto(
  itemId: string,
  url: string,
  file: File,
  contentType: string,
  onProgress: (progress: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    activeUploads.set(itemId, xhr);
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      activeUploads.delete(itemId);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("Could not upload this photo. Try again."));
    };
    xhr.onerror = () => {
      activeUploads.delete(itemId);
      reject(new Error("Could not upload this photo. Try again."));
    };
    xhr.onabort = () => {
      activeUploads.delete(itemId);
      reject(new DOMException("Aborted", "AbortError"));
    };
    xhr.send(file);
  });
}

async function uploadPhoto(
  itemId: string,
  file: File,
  previewUrl: string,
  setItems: React.Dispatch<React.SetStateAction<PhotoItem[]>>
) {
  const patch = (next: Partial<PhotoItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...next } : item))
    );
  };

  patch({ status: "uploading", progress: 0, error: null });
  cancelledUploads.delete(itemId);
  try {
    const res = await fetch("/api/uploads/rug-photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: file.type, size: file.size }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof data.error === "string"
          ? data.error
          : "Could not upload this photo. Try again."
      );
    }
    if (cancelledUploads.has(itemId)) return;
    await putPhoto(
      itemId,
      String(data.uploadUrl || ""),
      file,
      String(data.contentType || file.type),
      (progress) => patch({ progress })
    );
    const key = String(data.key || "");
    if (!isRugPhotoKey(key)) {
      throw new Error("Could not upload this photo. Try again.");
    }
    if (cancelledUploads.has(itemId)) return;
    previewByKey.set(key, previewUrl);
    patch({ status: "ready", progress: 100, key, error: null });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    patch({
      status: "error",
      progress: 0,
      error:
        err instanceof Error
          ? err.message
          : "Could not upload this photo. Try again.",
    });
  }
}

export function Step2Photos({ data, update, onUploadGateChange }: StepProps) {
  const [conditionFiles, setConditionFiles] = useState<PhotoItem[]>(() =>
    fromStored(data.rug?.photos)
  );
  const [labelFiles, setLabelFiles] = useState<PhotoItem[]>(() =>
    fromStored(data.rug?.labelPhotos)
  );
  const [labelError, setLabelError] = useState<string | null>(null);
  const [conditionError, setConditionError] = useState<string | null>(null);

  const pushFiles = useCallback(
    (
      list: FileList | null,
      setFiles: React.Dispatch<React.SetStateAction<PhotoItem[]>>,
      setError: (message: string | null) => void
    ) => {
      if (!list?.length) return;

      const accepted: PhotoItem[] = [];
      const errors: string[] = [];

      for (const file of Array.from(list)) {
        if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
          errors.push(`${file.name} is not a JPG, PNG, or WebP image.`);
          continue;
        }
        if (file.size > RUG_PHOTO_MAX_BYTES) {
          errors.push(`${file.name} is larger than ${RUG_PHOTO_MAX_LABEL}.`);
          continue;
        }
        const previewUrl = URL.createObjectURL(file);
        accepted.push({
          id: crypto.randomUUID(),
          previewUrl,
          key: null,
          file,
          status: "uploading",
          progress: 0,
          error: null,
        });
      }

      setError(errors.length ? errors.join(" ") : null);
      if (!accepted.length) return;
      setFiles((prev) => [...prev, ...accepted]);
      for (const item of accepted) {
        if (!item.file) continue;
        void uploadPhoto(item.id, item.file, item.previewUrl, setFiles);
      }
    },
    []
  );

  const removeAt = (
    index: number,
    entries: PhotoItem[],
    setFiles: React.Dispatch<React.SetStateAction<PhotoItem[]>>,
    setError: (message: string | null) => void
  ) => {
    const removed = entries[index];
    if (!removed) return;
    activeUploads.get(removed.id)?.abort();
    cancelledUploads.add(removed.id);
    if (removed.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(removed.previewUrl);
    }
    if (removed.key) {
      previewByKey.delete(removed.key);
      void fetch("/api/uploads/rug-photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: removed.key }),
      }).catch(() => undefined);
    }
    setFiles(entries.filter((_, i) => i !== index));
    setError(null);
  };

  const retryAt = (
    index: number,
    entries: PhotoItem[],
    setFiles: React.Dispatch<React.SetStateAction<PhotoItem[]>>
  ) => {
    const item = entries[index];
    if (!item?.file) return;
    void uploadPhoto(item.id, item.file, item.previewUrl, setFiles);
  };

  useEffect(() => {
    update({
      rug: {
        ...emptyRug(),
        ...data.rug,
        photos: readyKeys(conditionFiles),
        labelPhotos: readyKeys(labelFiles),
      },
    });
    // Parent form owns the other rug fields. This step owns the photo keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditionFiles, labelFiles]);

  useEffect(() => {
    const items = [...conditionFiles, ...labelFiles];
    onUploadGateChange?.({
      busy: items.some((item) => item.status === "uploading"),
      failed: items.some((item) => item.status === "error"),
    });
  }, [conditionFiles, labelFiles, onUploadGateChange]);

  return (
    <div className="space-y-5">
      <PhotoDropzone
        title="Back-of-Label Photo"
        badge="Optional"
        description="Upload the tag/label on the back of the rug (if present)."
        icon={<ImageIcon className="h-5 w-5 text-muted-foreground" />}
        browseLabel="Select Label Photos"
        files={labelFiles}
        error={labelError}
        onAdd={(files) => pushFiles(files, setLabelFiles, setLabelError)}
        onRemove={(index) => removeAt(index, labelFiles, setLabelFiles, setLabelError)}
        onRetry={(index) => retryAt(index, labelFiles, setLabelFiles)}
      />

      <PhotoDropzone
        title="Condition Photos"
        badge="Recommended"
        description="Upload 1 or more photos of the rug's front, back, and any visible stains or wear."
        icon={<Upload className="h-5 w-5 text-muted-foreground" />}
        browseLabel="Select Photos"
        files={conditionFiles}
        error={conditionError}
        onAdd={(files) => pushFiles(files, setConditionFiles, setConditionError)}
        onRemove={(index) =>
          removeAt(index, conditionFiles, setConditionFiles, setConditionError)
        }
        onRetry={(index) => retryAt(index, conditionFiles, setConditionFiles)}
      />
    </div>
  );
}

type PhotoDropzoneProps = {
  title: string;
  badge: string;
  description: string;
  icon: React.ReactNode;
  browseLabel: string;
  files: PhotoItem[];
  error: string | null;
  onAdd: (files: FileList | null) => void;
  onRemove: (index: number) => void;
  onRetry: (index: number) => void;
};

function PhotoDropzone({
  title,
  badge,
  description,
  icon,
  browseLabel,
  files,
  error,
  onAdd,
  onRemove,
  onRetry,
}: PhotoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const inputId = `${title.replace(/\s+/g, "-").toLowerCase()}-files`;

  const clearDrag = () => {
    dragDepth.current = 0;
    setIsDragging(false);
  };

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setIsDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        clearDrag();
        onAdd(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-xl border-2 border-dashed p-5 transition-colors sm:p-6",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold leading-tight">{title}</h4>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {badge}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPG, PNG, or WebP · max {RUG_PHOTO_MAX_LABEL} each
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="sr-only"
          onChange={(e) => {
            onAdd(e.target.files);
            e.currentTarget.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={() => inputRef.current?.click()}
        >
          {browseLabel}
        </Button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {files.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((entry, index) => (
            <li
              key={entry.id}
              className="group relative overflow-hidden rounded-lg border bg-muted/30"
            >
              {entry.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.previewUrl}
                  alt={`${title} ${index + 1}`}
                  className="h-28 w-full object-cover sm:h-32"
                />
              ) : (
                <div className="flex h-28 w-full items-center justify-center text-xs text-muted-foreground sm:h-32">
                  Uploaded
                </div>
              )}
              {entry.status === "uploading" ? (
                <div className="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1.5 text-[11px] font-medium text-white">
                  Uploading {entry.progress}%
                  <div className="mt-1 h-1 overflow-hidden rounded bg-white/30">
                    <div
                      className="h-full rounded bg-white"
                      style={{ width: `${entry.progress}%` }}
                    />
                  </div>
                </div>
              ) : null}
              {entry.status === "error" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-2 text-center">
                  <p className="text-[11px] font-medium leading-snug text-white" role="alert">
                    {entry.error || "Could not upload this photo."}
                  </p>
                  {entry.file ? (
                    <button
                      type="button"
                      onClick={() => onRetry(index)}
                      className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black"
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${title} ${index + 1}`}
                className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Drop images here, or use {browseLabel.toLowerCase()}.
        </p>
      )}
    </div>
  );
}
