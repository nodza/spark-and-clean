export type BookingStatus =
  | "BOOKED"
  | "SCHEDULED"
  | "COLLECTED"
  | "CLEANING"
  | "DRYING"
  | "READY"
  | "DELIVERED";

export type PaymentStatus = "UNPAID" | "DEPOSIT" | "PAID";

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
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Booking {
  id: string;
  customer: Customer;
  suburb: string;
  addressLine1: string;
  city: string;
  coordinates?: Coordinates;
  collectionDate: string; // ISO
  collectionSlot: "MORNING" | "AFTERNOON";
  rug: RugDetails;
  addOns: {
    odourRemoval: boolean;
    stainProtection: boolean;
  };
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  /** Phase 1 stub — format-validated promo code; discount calc deferred to E8 */
  couponCode?: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  assignedDriverId?: string;
  createdAt: string;
}

export interface Driver {
  id: string;
  name: string;
  vehicle: string;
}
