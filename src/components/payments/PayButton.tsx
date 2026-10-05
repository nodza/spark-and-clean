"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const appearance = {
  theme: "stripe",
  labels: "auto",
  inputs: "spaced",
  variables: {
    borderRadius: "4px",
    colorBackground: "#ffffff",
    colorDanger: "#df1b41",
    colorPrimary: "#0570de",
    colorSuccess: "#00c853",
    colorText: "#30313d",
    fontFamily: "default",
    fontSizeBase: "16px",
    spacingUnit: "4px",
  },
} as const;

const WEBHOOK_WAIT_MS = 15_000;
const WEBHOOK_POLL_MS = 1_000;

type CheckoutForm = {
  mount: (selector: string) => void;
  unmount?: () => void;
  on: (event: "confirm", handler: (event: unknown) => void) => void;
};

type CheckoutSdk = {
  createForm: (options: { layout: "expanded" }) => CheckoutForm;
  loadActions: () => Promise<
    | {
        type: "success";
        actions: {
          confirm: (args: {
            formConfirmEvent: unknown;
            redirect: "if_required";
          }) => Promise<unknown>;
        };
      }
    | { type: "error" }
  >;
};

type StripeJs = (
  key: string,
  options: {
    betas: string[];
    developerTools: { assistant: { enabled: false } };
  }
) => {
  initCheckoutFormSdk: (options: {
    clientSecret: string;
    appearance: typeof appearance;
  }) => CheckoutSdk;
};

declare global {
  interface Window {
    Stripe?: StripeJs;
  }
}

export type PayKind = "DEPOSIT" | "BALANCE";

type PayButtonProps = {
  bookingId: string;
  /** Amount charged for this checkout (deposit or remaining balance). */
  amountCents: number;
  kind?: PayKind;
  onPaid?: () => void;
};

function confirmErrorMessage(outcome: unknown): string | null {
  if (!outcome || typeof outcome !== "object" || !("type" in outcome)) return null;
  if ((outcome as { type?: string }).type !== "error") return null;
  const error = (outcome as { error?: { message?: string } }).error;
  return typeof error?.message === "string"
    ? error.message
    : "Check the card details and try again.";
}

function formatZar(cents: number): string {
  return new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function paymentComplete(kind: PayKind, paymentStatus: string | null): boolean {
  if (!paymentStatus) return false;
  if (kind === "BALANCE") return paymentStatus === "PAID";
  return paymentStatus !== "UNPAID";
}

async function readStoredStatus(
  bookingId: string,
  clientSecret?: string
): Promise<string | null> {
  const res = await fetch("/api/payments/sync-session", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingId,
      ...(clientSecret ? { clientSecret } : {}),
    }),
  });
  const data = (await res.json().catch(() => null)) as
    | { paymentStatus?: string }
    | null;
  if (!res.ok || typeof data?.paymentStatus !== "string") return null;
  return data.paymentStatus;
}

/**
 * Sync the Checkout session that was just paid, then poll until the booking
 * status catches up (webhook lag). Always pass clientSecret so a later BALANCE
 * session is not lost behind an older paid DEPOSIT session.
 */
async function waitForStoredStatus(
  bookingId: string,
  kind: PayKind,
  clientSecret: string
): Promise<string | null> {
  const first = await readStoredStatus(bookingId, clientSecret);
  if (paymentComplete(kind, first)) return first;

  const deadline = Date.now() + WEBHOOK_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, WEBHOOK_POLL_MS));
    const status = await readStoredStatus(bookingId, clientSecret);
    if (paymentComplete(kind, status)) return status;
  }
  return readStoredStatus(bookingId, clientSecret);
}

/**
 * Embedded Stripe Checkout form. Confirming payment does not set
 * paymentStatus — the webhook records the transfer.
 */
export function PayButton({
  bookingId,
  amountCents,
  kind = "DEPOSIT",
  onPaid,
}: PayButtonProps) {
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const formHostId = `checkout-form-${kind.toLowerCase()}`;
  const onPaidRef = useRef(onPaid);
  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  useEffect(() => {
    let cancelled = false;
    void readStoredStatus(bookingId)
      .then((paymentStatus) => {
        if (!cancelled && paymentComplete(kind, paymentStatus)) {
          onPaidRef.current?.();
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [bookingId, kind]);

  useEffect(() => {
    if (!clientSecret) return;
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey || !window.Stripe) return;

    let alive = true;

    const stripe = window.Stripe(publishableKey, {
      betas: ["custom_checkout_payment_form_1"],
      developerTools: { assistant: { enabled: false } },
    });
    const checkout = stripe.initCheckoutFormSdk({
      clientSecret,
      appearance,
    });
    const form = checkout.createForm({ layout: "expanded" });
    form.mount(`#${formHostId}`);

    void checkout.loadActions().then((loadActionsResult) => {
      if (!alive) return;
      if (loadActionsResult.type !== "success") {
        setError("Checkout could not be prepared. Please refresh and try again.");
        return;
      }
      form.on("confirm", (event) => {
        setConfirming(true);
        setError(null);
        void loadActionsResult.actions
          .confirm({
            formConfirmEvent: event,
            redirect: "if_required",
          })
          .then(async (outcome: unknown) => {
            const message = confirmErrorMessage(outcome);
            if (message) {
              setError(message);
              setConfirming(false);
              return;
            }

            const paymentStatus = await waitForStoredStatus(
              bookingId,
              kind,
              clientSecret
            );
            setConfirming(false);
            if (paymentComplete(kind, paymentStatus)) {
              onPaidRef.current?.();
              return;
            }
            setError(
              kind === "BALANCE"
                ? "Payment went through. This page will update when Stripe confirms the balance."
                : "Payment went through. This page will update when Stripe confirms the deposit."
            );
          })
          .catch(() => {
            setError("Payment could not be confirmed. Please try again.");
            setConfirming(false);
          });
      });
    });

    return () => {
      alive = false;
      form.unmount?.();
    };
  }, [bookingId, clientSecret, formHostId, kind]);

  async function startCheckout() {
    if (pending || clientSecret || amountCents < 1) return;
    if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
      setError("Card payments are not available right now.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/create-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          kind,
          provider: "STRIPE",
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { client_secret?: string; error?: string }
        | null;
      if (!res.ok || !data?.client_secret) {
        setError(data?.error || "Could not start checkout. Please try again.");
        setPending(false);
        return;
      }
      setClientSecret(data.client_secret);
      setPending(false);
    } catch {
      setError("Could not start checkout. Please try again.");
      setPending(false);
    }
  }

  if (amountCents < 1) {
    return (
      <p className="text-sm text-muted-foreground">
        {kind === "BALANCE"
          ? "There is no remaining balance on this booking."
          : "There is nothing to collect as a deposit on this booking yet."}
      </p>
    );
  }

  const payLabel =
    kind === "BALANCE"
      ? `Pay R ${formatZar(amountCents)} balance`
      : `Pay R ${formatZar(amountCents)} deposit`;

  return (
    <div className="space-y-3">
      {!clientSecret ? (
        <Button
          type="button"
          className="w-full justify-between"
          onClick={() => void startCheckout()}
          disabled={pending}
          aria-busy={pending}
        >
          <span className="flex items-center gap-2">
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <CreditCard className="size-4" aria-hidden />
            )}
            {pending ? "Loading secure checkout…" : payLabel}
          </span>
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      ) : null}
      <div id={formHostId} className="min-w-0" />
      {confirming ? (
        <p className="text-sm text-[#5c6570]">Checking your details…</p>
      ) : null}
      {error ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
