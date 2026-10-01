import { isClientRole, isFullAccount } from "@/types/user";

export type CheckoutCaller = {
  id?: string;
  email?: string;
  role?: string;
  guest?: boolean;
} | null;

export type CheckoutBooking = {
  userId?: string;
  status?: string;
  paymentStatus?: string;
  customer: { email: string };
};

export type CheckoutAccess =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 409; error: string };

/**
 * Linked account id, or the same email while the booking is still unclaimed.
 * A booking already linked to someone else is not owned by a matching email alone.
 */
export function clientOwnsBooking(
  session: CheckoutCaller,
  booking: Pick<CheckoutBooking, "userId" | "customer">
): boolean {
  if (!session?.id || !isFullAccount(session) || !isClientRole(session.role)) {
    return false;
  }
  if (booking.userId && booking.userId === session.id) return true;
  const email = session.email?.trim().toLowerCase() ?? "";
  const bookingEmail = booking.customer.email.trim().toLowerCase();
  return !booking.userId && email.length > 0 && bookingEmail === email;
}

function authorizeOwnedClientCheckout(
  session: CheckoutCaller,
  booking: CheckoutBooking
): CheckoutAccess {
  if (!session || !isFullAccount(session) || !isClientRole(session.role)) {
    if (!session || session.guest || session.id?.startsWith("guest:")) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
    return { ok: false, status: 403, error: "Forbidden" };
  }

  if (!clientOwnsBooking(session, booking)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  if (booking.status === "CANCELLED") {
    return {
      ok: false,
      status: 409,
      error: "This booking is cancelled.",
    };
  }

  return { ok: true };
}

/**
 * Only a signed-in client who owns the booking may start deposit Checkout.
 */
export function authorizeDepositCheckout(
  session: CheckoutCaller,
  booking: CheckoutBooking
): CheckoutAccess {
  const owned = authorizeOwnedClientCheckout(session, booking);
  if (!owned.ok) return owned;

  if (booking.paymentStatus !== "UNPAID") {
    return {
      ok: false,
      status: 409,
      error: "A deposit can only be started while the booking is unpaid.",
    };
  }

  return { ok: true };
}

/**
 * Balance Checkout is only for an owned booking that already has a deposit
 * and still has remaining cents.
 */
export function authorizeBalanceCheckout(
  session: CheckoutCaller,
  booking: CheckoutBooking,
  remainingCents: number
): CheckoutAccess {
  const owned = authorizeOwnedClientCheckout(session, booking);
  if (!owned.ok) return owned;

  if (booking.paymentStatus !== "DEPOSIT") {
    return {
      ok: false,
      status: 409,
      error: "The remaining balance can only be paid after a deposit.",
    };
  }

  if (!Number.isFinite(remainingCents) || remainingCents < 1) {
    return {
      ok: false,
      status: 409,
      error: "There is no remaining balance on this booking.",
    };
  }

  return { ok: true };
}
