"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Booking, RugDetails } from "@/types/booking";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, Upload, X } from "lucide-react";

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
}

type FileEntry = { file: File | null; url: string };

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const ACCEPT_ATTR = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = "5 MB";

function urlsFrom(entries: FileEntry[]) {
  return entries.map((entry) => entry.url);
}

function emptyRug(): RugDetails {
  return { type: "", widthM: 0, lengthM: 0, areaSqM: 0, photos: [], labelPhotos: [] };
}

export function Step2Photos({ data, update }: StepProps) {
  const [conditionFiles, setConditionFiles] = useState<FileEntry[]>(() =>
    (data.rug?.photos ?? []).map((url) => ({ file: null, url }))
  );
  const [labelFiles, setLabelFiles] = useState<FileEntry[]>(() =>
    (data.rug?.labelPhotos ?? []).map((url) => ({ file: null, url }))
  );
  const [labelError, setLabelError] = useState<string | null>(null);
  const [conditionError, setConditionError] = useState<string | null>(null);

  const conditionRef = useRef<FileEntry[]>([]);
  const labelRef = useRef<FileEntry[]>([]);

  useEffect(() => {
    conditionRef.current = conditionFiles;
  }, [conditionFiles]);
  useEffect(() => {
    labelRef.current = labelFiles;
  }, [labelFiles]);

  useEffect(() => {
    return () => {
      [...conditionRef.current, ...labelRef.current].forEach((entry) => {
        if (entry.file) URL.revokeObjectURL(entry.url);
      });
    };
  }, []);

  const pushFiles = useCallback(
    (
      list: FileList | null,
      setFiles: React.Dispatch<React.SetStateAction<FileEntry[]>>,
      setError: (message: string | null) => void
    ) => {
      if (!list?.length) return;

      const accepted: FileEntry[] = [];
      const errors: string[] = [];

      for (const file of Array.from(list)) {
        if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
          errors.push(`${file.name} is not a JPG, PNG, or WebP image.`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${file.name} is larger than ${MAX_FILE_SIZE_LABEL}.`);
          continue;
        }
        accepted.push({ file, url: URL.createObjectURL(file) });
      }

      setError(errors.length ? errors.join(" ") : null);
      if (accepted.length) {
        setFiles((prev) => [...prev, ...accepted]);
      }
    },
    []
  );

  const removeAt = (
    index: number,
    entries: FileEntry[],
    setFiles: React.Dispatch<React.SetStateAction<FileEntry[]>>,
    setError: (message: string | null) => void
  ) => {
    const removed = entries[index];
    if (removed?.file) URL.revokeObjectURL(removed.url);
    setFiles(entries.filter((_, i) => i !== index));
    setError(null);
  };

  useEffect(() => {
    update({
      rug: {
        ...emptyRug(),
        ...data.rug,
        photos: urlsFrom(conditionFiles),
        labelPhotos: urlsFrom(labelFiles),
      },
    });
    // Parent form is the source of other rug fields; photos are owned here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditionFiles, labelFiles]);

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
        onRemove={(index) => removeAt(index, conditionFiles, setConditionFiles, setConditionError)}
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
  files: FileEntry[];
  error: string | null;
  onAdd: (files: FileList | null) => void;
  onRemove: (index: number) => void;
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
              JPG, PNG, or WebP · max {MAX_FILE_SIZE_LABEL} each
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
            <li key={entry.url} className="group relative overflow-hidden rounded-lg border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.url}
                alt={`${title} ${index + 1}`}
                className="h-28 w-full object-cover sm:h-32"
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${title} ${index + 1}`}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-100 transition-opacity hover:bg-black/80 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
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
