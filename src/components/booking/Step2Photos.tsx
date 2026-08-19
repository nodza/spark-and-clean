"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Booking } from "@/types/booking";
import { Upload, X, Image as ImageIcon } from "lucide-react";

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
}

type FileEntry = { file: File | null; url: string };

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function Step2Photos({ data, update }: StepProps) {
  const initialCondition = (data.rug?.photos || []) as string[];
  const initialLabel = (data.rug?.labelPhotos || []) as string[];

  const [conditionFiles, setConditionFiles] = useState<FileEntry[]>(
    initialCondition.map((url) => ({ file: null, url }))
  );
  const [labelFiles, setLabelFiles] = useState<FileEntry[]>(
    initialLabel.map((url) => ({ file: null, url }))
  );

  const conditionRef = useRef<FileEntry[]>([]);
  const labelRef = useRef<FileEntry[]>([]);

  // keep refs in sync so cleanup can access latest arrays
  useEffect(() => {
    conditionRef.current = conditionFiles;
  }, [conditionFiles]);
  useEffect(() => {
    labelRef.current = labelFiles;
  }, [labelFiles]);

  useEffect(() => {
    return () => {
      [...conditionRef.current, ...labelRef.current].forEach((f) => f.file && URL.revokeObjectURL(f.url));
    };
  }, []);

  const validateAndAdd = (files: FileList | null, setter: (arr: FileEntry[]) => void) => {
    if (!files || files.length === 0) return;
    const accepted: FileEntry[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        alert(`Unsupported file type: ${file.name}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        alert(`File too large (max 5MB): ${file.name}`);
        continue;
      }
      const url = URL.createObjectURL(file);
      accepted.push({ file, url });
    }
    if (accepted.length === 0) return;
    setter((prev) => [...prev, ...accepted]);
  };

  const onConditionDrop = (e: React.DragEvent) => {
    e.preventDefault();
    validateAndAdd(e.dataTransfer.files, setConditionFiles);
  };
  const onLabelDrop = (e: React.DragEvent) => {
    e.preventDefault();
    validateAndAdd(e.dataTransfer.files, setLabelFiles);
  };

  const onConditionSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndAdd(e.target.files, setConditionFiles);
    e.currentTarget.value = "";
  };
  const onLabelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndAdd(e.target.files, setLabelFiles);
    e.currentTarget.value = "";
  };

  const labelInputRef = useRef<HTMLInputElement | null>(null);
  const conditionInputRef = useRef<HTMLInputElement | null>(null);

  const openLabelDialog = () => labelInputRef.current?.click();
  const openConditionDialog = () => conditionInputRef.current?.click();

  const removeCondition = (index: number) => {
    const removed = conditionFiles[index];
    if (removed && removed.file) URL.revokeObjectURL(removed.url);
    const next = conditionFiles.filter((_, i) => i !== index);
    setConditionFiles(next);
  };

  const removeLabel = (index: number) => {
    const removed = labelFiles[index];
    if (removed && removed.file) URL.revokeObjectURL(removed.url);
    const next = labelFiles.filter((_, i) => i !== index);
    setLabelFiles(next);
  };

  const propagate = () => {
    const condUrls = conditionFiles.map((f) => f.url);
    const labelUrls = labelFiles.map((f) => f.url);
    const newRug: any = { ...(data.rug ?? {}), photos: condUrls, labelPhotos: labelUrls };
    update({ rug: newRug });
  };

  useEffect(() => {
    propagate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditionFiles, labelFiles]);

  return (
    <div className="space-y-6">
      {/* Label photo upload (optional) */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onLabelDrop}
        className="p-6 border-2 border-dashed rounded-xl border-muted-foreground/25 hover:border-primary/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-secondary rounded-full">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold">Back-of-Label Photo (optional)</h4>
            <p className="text-sm text-muted-foreground">Upload the tag/label on the back of the rug (if present).</p>
          </div>
          <input ref={labelInputRef} id="label-files" type="file" accept={ACCEPTED_TYPES.join(",")} multiple onChange={onLabelSelect} className="hidden" />
          <Button variant="outline" onClick={openLabelDialog}>Select Label Photos</Button>
        </div>

        {labelFiles.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {labelFiles.map((f, i) => (
              <div key={i} className="relative group rounded overflow-hidden border">
                <img src={f.url} alt={`Label ${i + 1}`} className="w-full h-28 object-cover" />
                <button onClick={() => removeLabel(i)} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Condition photos upload (recommended, 1+ files) */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onConditionDrop}
        className="p-6 border-2 border-dashed rounded-xl border-muted-foreground/25 hover:border-primary/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-secondary rounded-full">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold">Condition Photos (recommended)</h4>
            <p className="text-sm text-muted-foreground">Upload 1 or more photos of the rug's front, back, and any visible stains or wear.</p>
          </div>
          <input ref={conditionInputRef} id="condition-files" type="file" accept={ACCEPTED_TYPES.join(",")} multiple onChange={onConditionSelect} className="hidden" />
          <Button variant="outline" onClick={openConditionDialog}>Select Photos</Button>
        </div>

        {conditionFiles.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {conditionFiles.map((f, i) => (
              <div key={i} className="relative group rounded-lg overflow-hidden border">
                <img src={f.url} alt={`Rug ${i + 1}`} className="w-full h-32 object-cover" />
                <button onClick={() => removeCondition(i)} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
