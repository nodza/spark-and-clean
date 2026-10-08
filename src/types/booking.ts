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
 * E8 promotion snapshot (optional). When amountDueCents is set, the ledger
 * uses it instead of the estimate midpoint. Confirm fills this from a server
 * coupon re-check, not from the client's posted total.
 */
export interface BookingPromotion {
  couponId?: string;
  code?: string;
  discountCents?: number;
  amountDueCents?: number;
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
  /** Kept for older screens. The charged discount is booking.promotion. */
  couponCode?: string;
  /** Ledger snapshot — optional until first succeeded transfer is recorded */
  billing?: BookingBilling;
  /** E8 — when present, amountDueCents overrides estimate midpoint */
  promotion?: BookingPromotion;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  assignedDriverId?: string;
  technician?: {
    name: string;
    phone?: string;
  };
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
