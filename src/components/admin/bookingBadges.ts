import type { ComponentProps } from "react";
import type { Badge } from "@/components/ui/badge";
import type { BookingStatus, PaymentStatus } from "@/types/booking";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

export function bookingStatusVariant(status: string): BadgeVariant {
  const s = status.toUpperCase() as BookingStatus | string;
  if (s === "BOOKED" || s === "SCHEDULED") return "status-new";
  if (s === "COLLECTED") return "status-collected";
  if (s === "CLEANING" || s === "DRYING") return "status-cleaning";
  if (s === "READY") return "status-delivering";
  if (s === "DELIVERED") return "status-completed";
  if (s === "CANCELLED") return "status-overdue";
  return "outline";
}

export function paymentStatusVariant(status: string): BadgeVariant {
  const s = status.toUpperCase() as PaymentStatus | string;
  if (s === "UNPAID") return "status-overdue";
  if (s === "DEPOSIT") return "status-new";
  if (s === "PAID") return "status-cleaning";
  return "outline";
}
