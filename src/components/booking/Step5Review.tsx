import type { ReactNode } from "react";
import { Booking } from "@/types/booking";
import { getRugTypeLabel } from "@/data/rugTypes";
import type { WizardRug, WizardRugQuoteLine } from "@/lib/wizardRugs";
import { bookingAddOnLabels, OPS_ADD_ON_COPY } from "@/lib/techUi";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MapPin, Ruler, Tag, WalletCards } from "lucide-react";
import { formatBookingCollection } from "@/lib/localCalendarDate";

interface StepProps {
  data: Partial<Booking>;
  termsAccepted: boolean;
  onTermsAcceptedChange: (accepted: boolean) => void;
  rugLines?: WizardRugQuoteLine[];
  rugs?: WizardRug[];
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

function rugPriceLabel(line: WizardRugQuoteLine): string {
  if (line.dimensionsSkipped || line.totalMin <= 0) return "Measured on pickup";
  if (line.totalMax > line.totalMin) return `R${line.totalMin} – R${line.totalMax}`;
  return `R${line.totalMin}`;
}

export function Step5Review({
  data,
  termsAccepted,
  onTermsAcceptedChange,
  rugLines = [],
  rugs = [],
}: StepProps) {
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

  const collectionDate = data.collectionDate
    ? formatBookingCollection(data.collectionDate, "PPP", "") || null
    : null;
  const collectionSlot =
    data.collectionSlot === "MORNING"
      ? "Morning · 08:00 – 12:00"
      : data.collectionSlot === "AFTERNOON"
        ? "Afternoon · 12:00 – 16:00"
        : null;

  const addOns =
    bookingAddOnLabels(data.addOns, OPS_ADD_ON_COPY).join(", ") || "None";

  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="flex items-center gap-2 border-b pb-3 text-base font-semibold">
          <Ruler className="h-4 w-4 text-primary" aria-hidden="true" />{" "}
          {rugs.length > 1 ? `Rugs (${rugs.length})` : "Rug Profile"}
        </h3>
        {rugs.length > 0 ? (
          <div className="flex flex-col gap-4 pt-4">
            {rugs.map((rug, index) => {
              const sized =
                typeof rug.widthM === "number" &&
                typeof rug.lengthM === "number" &&
                rug.widthM > 0 &&
                rug.lengthM > 0;
              const addOnLabel =
                bookingAddOnLabels(rug.addOns, OPS_ADD_ON_COPY).join(", ") || "None";
              return (
                <dl
                  key={rug.id}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                >
                  <Detail label={`Rug ${index + 1}`}>
                    {rug.type ? getRugTypeLabel(rug.type) : "Not provided"}
                  </Detail>
                  <Detail label="Dimensions">
                    {sized
                      ? `${rug.widthM}m × ${rug.lengthM}m`
                      : "Pending (Measured by Driver on Pickup)"}
                  </Detail>
                  <Detail label="Add-ons">{addOnLabel}</Detail>
                  <Detail label="Photos">
                    {rug.photos.length || rug.labelPhotos.length
                      ? `${rug.photos.length + rug.labelPhotos.length} provided`
                      : "None provided"}
                  </Detail>
                </dl>
              );
            })}
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
            <Detail label="Rug">{rugLabel ? rugLabel : "Not provided"}</Detail>
            <Detail label="Dimensions">
              {hasSize
                ? `${data.rug!.widthM}m × ${data.rug!.lengthM}m`
                : "Pending (Measured by Driver on Pickup)"}
            </Detail>
            <Detail label="Label Photo">
              {data.rug?.labelPhotos?.length ? "Provided" : "None provided"}
            </Detail>
            <Detail label="Cleaning Photos">
              {data.rug?.photos?.length
                ? `${data.rug.photos.length} provided`
                : "None provided"}
            </Detail>
          </dl>
        )}
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

      {rugs.length <= 1 ? (
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="flex items-center gap-2 border-b pb-3 text-base font-semibold">
            <Tag className="h-4 w-4 text-primary" aria-hidden="true" /> Upsell Add-ons
          </h3>
          <p className="pt-4 text-sm font-medium">{addOns}</p>
        </section>
      ) : null}

      <section className="rounded-xl border bg-primary/5 p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <WalletCards className="h-4 w-4 text-primary" aria-hidden="true" /> Est. Total Price
        </h3>
        {rugLines.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {rugLines.map((line, index) => (
              <li key={line.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  Rug {index + 1}
                  {line.type ? ` · ${getRugTypeLabel(line.type)}` : ""}
                </span>
                <span className="font-semibold">{rugPriceLabel(line)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-2xl font-bold text-primary">
          {data.estimatedPriceMin != null && data.estimatedPriceMax != null
            ? rugLines.some((line) => line.dimensionsSkipped)
              ? "Measured on pickup"
              : `R${data.estimatedPriceMin} – R${data.estimatedPriceMax}`
            : "Pending"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {rugLines.length > 1
            ? "Total for this booking. Final pricing is confirmed after driver verification."
            : "Final pricing is confirmed after driver verification."}
        </p>
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
