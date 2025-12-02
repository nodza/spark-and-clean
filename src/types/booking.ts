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
  widthM: number;
  lengthM: number;
  areaSqM: number;
  photos?: string[]; // local URLs for mock
}

export interface Booking {
  id: string;
  customer: Customer;
  suburb: string;
  addressLine1: string;
  city: string;
  collectionDate: string; // ISO
  collectionSlot: "MORNING" | "AFTERNOON";
  rug: RugDetails;
  addOns: {
    stainTreatment: boolean;
    fabricProtection: boolean;
  };
  estimatedPriceMin: number;
  estimatedPriceMax: number;
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
