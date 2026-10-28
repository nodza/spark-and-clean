export type BookingStatus =
  | "BOOKED"
  | "SCHEDULED"
  | "COLLECTED"
  | "CLEANING"
  | "DRYING"
  | "READY"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentStatus = "UNPAID" | "DEPOSIT" | "PAID";

/** Snapshot of cents due/paid — paymentStatus is derived from these. */
export interface BookingBilling {
  currency: string;
  amountDueCents: number;
  amountPaidCents: number;
}

/**
 * Price after a driver measurement or an admin size correction.
 * `estimatedPriceMin` / `estimatedPriceMax` on the booking stay the original quote.
 */
export interface MeasuredQuote {
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  amountDueCents: number;
  discountCents: number;
  /** ISO time of the latest measurement or correction. */
  measuredAt: string;
}

/**
 * E8 promotion snapshot (optional). When amountDueCents is set, the ledger
 * uses it instead of the estimate midpoint. Confirm fills this from a server
 * coupon re-check, not from the client's posted total.
 */
export interface BookingPromotion {
  couponId?: string;
  code?: string;
  discountCents?: number;
  amountDueCents?: number;
  /** ISO time of the one loyalty punch for this booking. */
  loyaltyPunchedAt?: string;
}

/** Ops-only — never sent on customer/public booking payloads */
export interface InternalNote {
  id: string;
  body: string;
  author: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export interface RugDetails {
  type: string; // Persian, Kilim, etc.
  widthM: number | null;
  lengthM: number | null;
  areaSqM: number;
  photos?: string[]; // local URLs for mock
  labelPhotos?: string[]; // back-of-label / tag photos
  tagCode?: string;
  assetId?: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Booking {
  id: string;
  /** Registered client User id (ObjectId string). Guests omit this. */
  userId?: string;
  customer: Customer;
  suburb: string;
  addressLine1: string;
  city: string;
  coordinates?: Coordinates;
  /** Calendar day `yyyy-MM-dd` (legacy rows may still store ISO timestamps). */
  collectionDate: string;
  collectionSlot: "MORNING" | "AFTERNOON";
  rug: RugDetails;
  addOns: {
    odourRemoval: boolean;
    stainProtection: boolean;
  };
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  /**
   * Set when a size is saved at collection or corrected by a full admin.
   * The original quote stays on estimatedPriceMin / estimatedPriceMax.
   */
  measuredQuote?: MeasuredQuote;
  /**
   * Succeeded payments are higher than the amount due after a measurement.
   * Ops still need to refund the difference.
   */
  refundRequired?: boolean;
  /** Kept for older screens. The charged discount is booking.promotion. */
  couponCode?: string;
  /** Ledger snapshot — optional until first succeeded transfer is recorded */
  billing?: BookingBilling;
  /** E8 — when present, amountDueCents overrides estimate midpoint */
  promotion?: BookingPromotion;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  assignedDriverId?: string;
  /**
   * Soft-removed from the active admin list. Distinct from status CANCELLED —
   * original status/price/location stay for analytics.
   */
  deactivatedAt?: string | null;
  technician?: {
    name: string;
    phone?: string;
  };
  /**
   * Computed for ops/tech display only — not stored on the booking.
   * Day-log vehicles for assignedDriverId on the collection date.
   */
  dayVehicles?: { label: string; plate: string }[];
  /** Standing register bakkie for the assigned driver (ops/tech display). */
  standingVehicle?: { label: string; plate: string } | null;
  updatedAt?: string;
  createdAt: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email?: string;
  /** Current bakkie display from Vehicle.assignedDriverId — not stored on the job. */
  vehicle?: string;
  isActive: boolean;
  city?: string;
}
