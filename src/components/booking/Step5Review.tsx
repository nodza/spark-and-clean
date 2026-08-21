import type { ReactNode } from "react";
import { Booking } from "@/types/booking";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { format } from "date-fns";
import { MapPin } from "lucide-react";

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
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

export function Step5Review({ data }: StepProps) {
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
    ? format(new Date(data.collectionDate), "PPP")
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
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        {/* Address hero block — compact */}
        <section className="rounded-lg bg-muted/50 px-3.5 py-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background text-primary ring-1 ring-border">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Collection address
              </p>

              <h3 className="mt-1 text-sm font-semibold leading-snug tracking-tight text-foreground text-balance sm:text-[15px]">
                {[street || "No street address", locality].filter(Boolean).join(", ")}
              </h3>

              {hasCoordinates ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <p className="tabular-nums text-foreground">
                    <span className="font-medium text-muted-foreground">
                      Latitude
                    </span>{" "}
                    <span className="font-medium">
                      {data.coordinates!.lat.toFixed(5)}
                    </span>
                  </p>
                  <p className="tabular-nums text-foreground">
                    <span className="font-medium text-muted-foreground">
                      Longitude
                    </span>{" "}
                    <span className="font-medium">
                      {data.coordinates!.lng.toFixed(5)}
                    </span>
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <dl className="mt-4 grid grid-cols-1 gap-4 px-1 sm:grid-cols-2">
          <Detail label="Rug">
            {rugLabel ? (
              <>
                {rugLabel}
                {" · "}
                {hasSize
                  ? `${data.rug!.widthM}m × ${data.rug!.lengthM}m`
                  : "To be measured by driver"}
              </>
            ) : (
              "Not set"
            )}
          </Detail>

          <Detail label="Collection">
            {collectionDate || collectionSlot ? (
              <>
                {collectionDate ?? "Date not set"}
                {collectionSlot ? (
                  <>
                    <br />
                    <span className="font-normal text-muted-foreground">
                      {collectionSlot}
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              "Not set"
            )}
          </Detail>

          <Detail label="Add-ons">{addOns}</Detail>

          {data.customer?.name ? (
            <Detail label="Contact">
              {data.customer.name}
              {data.customer.phone ? ` · ${data.customer.phone}` : ""}
            </Detail>
          ) : null}
        </dl>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-primary/5 px-3.5 py-2.5">
          <span className="text-sm text-muted-foreground">Estimated total</span>
          <span className="text-base font-semibold text-primary">
            {data.estimatedPriceMin != null && data.estimatedPriceMax != null
              ? `R${data.estimatedPriceMin} – R${data.estimatedPriceMax}`
              : "Pending"}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Payment method</h3>
        <RadioGroup
          defaultValue="eft"
          onValueChange={(val) => console.log(val)}
          className="gap-2.5"
        >
          <Label
            htmlFor="eft"
            className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 font-normal transition-colors hover:bg-muted/30"
          >
            <RadioGroupItem value="eft" id="eft" />
            <span className="text-sm">EFT / Bank Transfer</span>
          </Label>
          <Label
            htmlFor="card"
            className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 font-normal transition-colors hover:bg-muted/30"
          >
            <RadioGroupItem value="card" id="card" />
            <span className="text-sm">Card on Delivery (Yoco/Tap)</span>
          </Label>
        </RadioGroup>
      </div>
    </div>
  );
}
