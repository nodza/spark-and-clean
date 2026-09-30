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

type PayButtonProps = {
  bookingId: string;
  depositCents: number;
  onPaid?: () => void;
};

const WEBHOOK_WAIT_MS = 15_000;
const WEBHOOK_POLL_MS = 1_500;
const DEPOSIT_PENDING_NOTICE =
  "Your payment went through. The deposit will show on this booking shortly.";

async function readStoredPaymentStatus(bookingId: string): Promise<string | null> {
  const res = await fetch("/api/payments/sync-session", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId }),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as
    | { paymentStatus?: string }
    | null;
  return typeof data?.paymentStatus === "string" ? data.paymentStatus : null;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function confirmErrorMessage(outcome: unknown): string | null {
  if (!outcome || typeof outcome !== "object" || !("type" in outcome)) return null;
  if ((outcome as { type?: string }).type !== "error") return null;
  const error = (outcome as { error?: { message?: string } }).error;
  return typeof error?.message === "string"
    ? error.message
    : "Check the card details and try again.";
}

/**
 * Embedded card form. Confirming payment does not set paymentStatus.
 * The signed webhook is the only automatic writer of the deposit.
 */
export function PayButton({ bookingId, depositCents, onPaid }: PayButtonProps) {
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const onPaidRef = useRef(onPaid);
  const submittedRef = useRef(false);
  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  useEffect(() => {
    if (!notice) return;
    let cancelled = false;
    const id = window.setInterval(() => {
      void readStoredPaymentStatus(bookingId).then((status) => {
        if (!cancelled && status && status !== "UNPAID") {
          onPaidRef.current?.();
        }
      });
    }, WEBHOOK_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [notice, bookingId]);

  useEffect(() => {
    let cancelled = false;
    void readStoredPaymentStatus(bookingId)
      .then((status) => {
        if (!cancelled && status && status !== "UNPAID") {
          onPaidRef.current?.();
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

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
    form.mount("#checkout-form");

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
            if (!alive) return;
            if (message) {
              setError(message);
              setConfirming(false);
              return;
            }

            setConfirming(false);
            submittedRef.current = true;
            setSubmitted(true);
            setWaiting(true);
            setNotice(null);
            const started = Date.now();
            let status: string | null = null;
            while (alive && Date.now() - started < WEBHOOK_WAIT_MS) {
              status = await readStoredPaymentStatus(bookingId);
              if (!alive) return;
              if (status && status !== "UNPAID") break;
              await delay(WEBHOOK_POLL_MS);
            }
            if (!alive) return;
            setWaiting(false);
            if (status && status !== "UNPAID") {
              onPaidRef.current?.();
              return;
            }
            setNotice(DEPOSIT_PENDING_NOTICE);
          })
          .catch(() => {
            if (!alive) return;
            setConfirming(false);
            setWaiting(false);
            if (submittedRef.current) {
              setNotice(DEPOSIT_PENDING_NOTICE);
              return;
            }
            setError("Payment could not be confirmed. Please try again.");
          });
      });
    });

    return () => {
      alive = false;
      form.unmount?.();
    };
  }, [bookingId, clientSecret]);

  async function startCheckout() {
    if (pending || clientSecret || depositCents < 1) return;
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
          kind: "DEPOSIT",
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

  if (depositCents < 1) {
    return (
      <p className="text-sm text-muted-foreground">
        There is nothing to collect as a deposit on this booking yet.
      </p>
    );
  }

  return (
    <div
      className={`space-y-3 ${waiting || submitted ? "pointer-events-none" : ""}`}
      aria-busy={pending || confirming || waiting}
    >
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
            {pending
              ? "Loading secure checkout…"
              : `Pay R ${new Intl.NumberFormat("en-ZA", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(depositCents / 100)} deposit`}
          </span>
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      ) : null}
      <div id="checkout-form" className="min-w-0" />
      {confirming ? (
        <p className="text-sm text-[#5c6570]" role="status">
          Checking your details…
        </p>
      ) : null}
      {waiting ? (
        <p className="text-sm text-[#5c6570]" role="status" aria-live="polite">
          Your payment went through. Adding the deposit to your booking…
        </p>
      ) : null}
      {notice ? (
        <p
          className="rounded-lg border border-[#d7efe4] bg-[#f3fbf7] px-3 py-2 text-sm text-[#0a7a63]"
          role="status"
        >
          {notice}
        </p>
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
