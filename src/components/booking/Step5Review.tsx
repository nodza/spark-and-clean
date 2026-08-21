import type { ReactNode } from "react";
import { Booking } from "@/types/booking";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { MapPin, Ruler, Tag, WalletCards } from "lucide-react";

interface StepProps {
  data: Partial<Booking>;
  termsAccepted: boolean;
  onTermsAcceptedChange: (accepted: boolean) => void;
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-[15px] font-medium leading-snug text-foreground">
        {children}
      </dd>
    </div>
  );
}

export function Step5Review({ data, termsAccepted, onTermsAcceptedChange }: StepProps) {
  const street = data.addressLine1?.trim() || "";
  const locality = [data.suburb, data.city].filter(Boolean).join(", ");

  const hasCoordinates =
    typeof data.coordinates?.lat === "number" &&
    typeof data.coordinates?.lng === "number" &&
    Number.isFinite(data.coordinates.lat) &&
    Number.isFinite(data.coordinates.lng);

  const rugLabel = data.rug?.type?.trim() || null;
  const hasSize =
    typeof data.rug?.widthM === "number" &&
    typeof data.rug?.lengthM === "number" &&
    data.rug.widthM > 0 &&
    data.rug.lengthM > 0;

  const parsedCollectionDate = data.collectionDate ? new Date(data.collectionDate) : null;
  const collectionDate = parsedCollectionDate && !Number.isNaN(parsedCollectionDate.getTime())
    ? format(parsedCollectionDate, "PPP")
    : null;
  const collectionSlot =
    data.collectionSlot === "MORNING"
      ? "Morning · 08:00 – 12:00"
      : data.collectionSlot === "AFTERNOON"
        ? "Afternoon · 12:00 – 16:00"
        : null;

  const addOns =
    [
      data.addOns?.stainTreatment && "Stain Treatment",
      data.addOns?.fabricProtection && "Fiber Shield",
    ]
      .filter(Boolean)
      .join(", ") || "None";

  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="flex items-center gap-2 border-b pb-3 text-base font-semibold">
          <Ruler className="h-4 w-4 text-primary" aria-hidden="true" /> Rug Profile
        </h3>
        <dl className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
          <Detail label="Rug">
            {rugLabel ? (
              rugLabel
            ) : (
              "Not provided"
            )}
          </Detail>
          <Detail label="Dimensions">
            {hasSize ? `${data.rug!.widthM}m × ${data.rug!.lengthM}m` : "Pending (Measured by Driver on Pickup)"}
          </Detail>
          <Detail label="Label Photo">{data.rug?.labelPhotos?.length ? "Provided" : "None provided"}</Detail>
          <Detail label="Cleaning Photos">{data.rug?.photos?.length ? `${data.rug.photos.length} provided` : "None provided"}</Detail>
        </dl>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="flex items-center gap-2 border-b pb-3 text-base font-semibold">
          <MapPin className="h-4 w-4 text-primary" aria-hidden="true" /> Pickup Location & Time
        </h3>
        <dl className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
          <Detail label="Address">{[street, locality].filter(Boolean).join(", ") || "Not provided"}</Detail>
          <Detail label="Pickup window">
            {collectionDate || collectionSlot ? `${collectionDate || "Date pending"}${collectionSlot ? ` · ${collectionSlot}` : ""}` : "Not provided"}
          </Detail>
          {hasCoordinates ? <Detail label="Coordinates">{data.coordinates!.lat.toFixed(5)}, {data.coordinates!.lng.toFixed(5)}</Detail> : null}
        </dl>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="flex items-center gap-2 border-b pb-3 text-base font-semibold">
          <Tag className="h-4 w-4 text-primary" aria-hidden="true" /> Upsell Add-ons
        </h3>
        <p className="pt-4 text-sm font-medium">{addOns}</p>
      </section>

      <section className="rounded-xl border bg-primary/5 p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <WalletCards className="h-4 w-4 text-primary" aria-hidden="true" /> Est. Total Price
        </h3>
        <p className="mt-3 text-2xl font-bold text-primary">
          {data.estimatedPriceMin != null && data.estimatedPriceMax != null ? `R${data.estimatedPriceMin} – R${data.estimatedPriceMax}` : "Pending"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Final pricing is confirmed after driver verification.</p>
      </section>

      <div className="flex items-start gap-3 rounded-lg border p-4">
        <Checkbox id="terms-accepted" checked={termsAccepted} onCheckedChange={(checked) => onTermsAcceptedChange(checked === true)} />
        <Label htmlFor="terms-accepted" className="cursor-pointer text-sm font-normal leading-relaxed">
          I agree to the terms of service and understand pricing is an estimate subject to driver verification.
        </Label>
      </div>
    </div>
  );
}
