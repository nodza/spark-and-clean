import type { BookingStatus } from "@/types/booking";
import { Check, Droplets, Package, Sparkles, Sun, Truck, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

export const BOOKING_STATUS_STEPS: {
  id: BookingStatus;
  label: string;
  description: string;
  icon: typeof Package;
}[] = [
  {
    id: "BOOKED",
    label: "Booked",
    description: "We’ve received your collection request",
    icon: Package,
  },
  {
    id: "SCHEDULED",
    label: "Scheduled",
    description: "Pickup window confirmed with our drivers",
    icon: Truck,
  },
  {
    id: "COLLECTED",
    label: "Collected",
    description: "Your rug is on the way to our facility",
    icon: Warehouse,
  },
  {
    id: "CLEANING",
    label: "Cleaning",
    description: "Deep wash and specialist treatment in progress",
    icon: Droplets,
  },
  {
    id: "DRYING",
    label: "Drying",
    description: "Controlled drying for finish and fibre care",
    icon: Sun,
  },
  {
    id: "READY",
    label: "Ready",
    description: "Cleaned and queued for delivery",
    icon: Sparkles,
  },
  {
    id: "DELIVERED",
    label: "Delivered",
    description: "Returned to your address — enjoy the fresh look",
    icon: Check,
  },
];

type BookingStatusTimelineProps = {
  status: BookingStatus;
  className?: string;
};

export function BookingStatusTimeline({
  status,
  className,
}: BookingStatusTimelineProps) {
  const currentIndex = BOOKING_STATUS_STEPS.findIndex((s) => s.id === status);
  const safeIndex = currentIndex < 0 ? 0 : currentIndex;

  return (
    <ol
      className={cn("relative space-y-0", className)}
      aria-label="Booking progress"
    >
      {BOOKING_STATUS_STEPS.map((step, index) => {
        const isCompleted = index < safeIndex;
        const isCurrent = index === safeIndex;
        const isUpcoming = index > safeIndex;
        const isLast = index === BOOKING_STATUS_STEPS.length - 1;
        const StepIcon = step.icon;

        return (
          <li
            key={step.id}
            className="relative flex gap-3 sm:gap-4 pb-8 last:pb-0"
            aria-current={isCurrent ? "step" : undefined}
          >
            {!isLast && (
              <span
                className={cn(
                  "absolute left-[15px] sm:left-[17px] top-9 bottom-0 w-0.5",
                  isCompleted || isCurrent ? "bg-primary" : "bg-border"
                )}
                aria-hidden
              />
            )}

            <div
              className={cn(
                "relative z-10 flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                isCompleted &&
                  "border-primary bg-primary text-primary-foreground",
                isCurrent &&
                  "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15",
                isUpcoming &&
                  "border-muted-foreground/30 bg-background text-muted-foreground"
              )}
            >
              {isCompleted ? (
                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              ) : (
                <StepIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
              )}
            </div>

            <div className="min-w-0 flex-1 pt-0.5 sm:pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={cn(
                    "text-sm sm:text-base font-semibold leading-tight",
                    isCurrent && "text-primary text-base sm:text-lg",
                    isUpcoming && "text-muted-foreground font-medium"
                  )}
                >
                  {step.label}
                </p>
                {isCurrent && status !== "DELIVERED" && (
                  <span className="inline-flex items-center rounded-full bg-secondary/30 px-2 py-0.5 text-[11px] font-medium text-foreground">
                    <span
                      className="mr-1.5 h-1.5 w-1.5 rounded-full bg-secondary animate-pulse"
                      aria-hidden
                    />
                    In progress
                  </span>
                )}
                {isCurrent && status === "DELIVERED" && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    Complete
                  </span>
                )}
              </div>
              <p
                className={cn(
                  "mt-1 text-xs sm:text-sm leading-relaxed",
                  isUpcoming ? "text-muted-foreground/80" : "text-muted-foreground"
                )}
              >
                {step.description}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
