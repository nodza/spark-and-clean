"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, CreditCard, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

type PayKind = "DEPOSIT" | "BALANCE";
type PayProvider = "STRIPE" | "OZOW";

type PayButtonProps = {
  bookingId: string;
  amountCents: number;
  kind?: PayKind;
  onPaid?: () => void;
};

const WEBHOOK_WAIT_MS = 15_000;
const WEBHOOK_POLL_MS = 1_500;
const DEPOSIT_PENDING_NOTICE =
  "Your payment went through. The deposit will show on this booking shortly.";

function storedStatusMeansPaid(kind: PayKind, status: string): boolean {
  if (kind === "BALANCE") return status === "PAID";
  return status !== "UNPAID";
}

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

function formatRand(cents: number) {
  return new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Card (Stripe) and/or Instant EFT (Ozow). Confirming payment does not set
 * paymentStatus. The signed Stripe webhook (or Ozow notify) is the only
 * automatic writer of the deposit.
 */
export function PayButton({
  bookingId,
  amountCents,
  kind = "DEPOSIT",
  onPaid,
}: PayButtonProps) {
  const [providers, setProviders] = useState<{
    stripe: boolean;
    ozow: boolean;
    ozowConfigured: boolean;
  } | null>(null);
  const [selected, setSelected] = useState<PayProvider | null>(null);
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
    let cancelled = false;
    void fetch("/api/payments/providers")
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as {
          stripe?: boolean;
          ozow?: boolean;
        } | null;
        if (cancelled) return;
        const stripeFromApi = Boolean(data?.stripe);
        const stripeFallback = Boolean(
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
        );
        const stripeConfigured = stripeFromApi || stripeFallback;
        const ozowConfigured = Boolean(data?.ozow);
        const stripe = stripeConfigured && kind === "DEPOSIT";
        const ozow =
          ozowConfigured && (kind === "DEPOSIT" || kind === "BALANCE");
        setProviders({ stripe, ozow, ozowConfigured });
        if (stripe) setSelected("STRIPE");
        else if (ozow) setSelected("OZOW");
        else if (kind === "DEPOSIT") setSelected("OZOW"); // show EFT + not-configured msg
        else setSelected("OZOW");
      })
      .catch(() => {
        if (cancelled) return;
        const stripeFallback =
          Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()) &&
          kind === "DEPOSIT";
        setProviders({
          stripe: stripeFallback,
          ozow: false,
          ozowConfigured: false,
        });
        setSelected(stripeFallback ? "STRIPE" : "OZOW");
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  useEffect(() => {
    if (!notice) return;
    let cancelled = false;
    const id = window.setInterval(() => {
      void readStoredPaymentStatus(bookingId).then((status) => {
        if (!cancelled && status && storedStatusMeansPaid(kind, status)) {
          onPaidRef.current?.();
        }
      });
    }, WEBHOOK_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [notice, bookingId, kind]);

  useEffect(() => {
    let cancelled = false;
    void readStoredPaymentStatus(bookingId)
      .then((status) => {
        if (!cancelled && status && storedStatusMeansPaid(kind, status)) {
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
              if (status && storedStatusMeansPaid(kind, status)) break;
              await delay(WEBHOOK_POLL_MS);
            }
            if (!alive) return;
            setWaiting(false);
            if (status && storedStatusMeansPaid(kind, status)) {
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
  }, [bookingId, clientSecret, kind]);

  async function startCheckout() {
    if (pending || clientSecret || amountCents < 1 || !selected) return;
    if (selected === "OZOW" && !providers?.ozowConfigured) {
      setError("Instant EFT is not available right now.");
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
          provider: selected,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { client_secret?: string; url?: string; error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error || "Could not start checkout. Please try again.");
        setPending(false);
        return;
      }
      if (selected === "OZOW") {
        if (!data?.url) {
          setError("Could not start Instant EFT. Please try again.");
          setPending(false);
          return;
        }
        window.location.assign(data.url);
        return;
      }
      if (!data?.client_secret) {
        setError("Could not start checkout. Please try again.");
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

  const ozowNotConfiguredMessage =
    "Instant EFT is not available right now.";

  if (providers === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Checking payment options…
      </div>
    );
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

  // Balance is Ozow-only today — still show the not-configured message, don't hide quietly.
  if (kind === "BALANCE" && !providers.ozowConfigured) {
    return (
      <p className="text-sm text-muted-foreground">{ozowNotConfiguredMessage}</p>
    );
  }

  if (!providers.stripe && !providers.ozowConfigured && kind === "DEPOSIT") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Payment method">
          <button
            type="button"
            disabled
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[#e3e7ed] bg-[#f5f7fa] px-3 py-2 text-xs font-bold text-[#9aa0a6]"
          >
            <CreditCard className="size-3.5" aria-hidden />
            Card
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-navy bg-navy px-3 py-2 text-xs font-bold text-white"
          >
            <Building2 className="size-3.5" aria-hidden />
            Instant EFT
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{ozowNotConfiguredMessage}</p>
        <p className="text-sm text-muted-foreground">
          Card payments are also unavailable right now.
        </p>
      </div>
    );
  }

  const label =
    kind === "BALANCE"
      ? `Pay R ${formatRand(amountCents)} balance`
      : `Pay R ${formatRand(amountCents)} deposit`;

  // Always show Card vs Instant EFT on deposit; never hide EFT when Ozow env is missing.
  const showChooser = kind === "DEPOSIT" && !clientSecret;
  const ozowReady = providers.ozowConfigured && providers.ozow;
  const canPaySelected =
    selected === "STRIPE"
      ? providers.stripe
      : selected === "OZOW"
        ? ozowReady
        : false;

  return (
    <div
      className={cn("space-y-3", (waiting || submitted) && "pointer-events-none")}
      aria-busy={pending || confirming || waiting}
    >
      {showChooser ? (
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Payment method">
          {providers.stripe ? (
            <button
              type="button"
              onClick={() => {
                setSelected("STRIPE");
                setError(null);
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold",
                selected === "STRIPE"
                  ? "border-navy bg-navy text-white"
                  : "border-[#e3e7ed] bg-white text-navy hover:bg-[#f5f7fa]"
              )}
            >
              <CreditCard className="size-3.5" aria-hidden />
              Card
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setSelected("OZOW");
              setError(null);
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold",
              selected === "OZOW"
                ? "border-navy bg-navy text-white"
                : "border-[#e3e7ed] bg-white text-navy hover:bg-[#f5f7fa]",
              !providers.stripe && "col-span-2"
            )}
          >
            <Building2 className="size-3.5" aria-hidden />
            Instant EFT
          </button>
        </div>
      ) : null}

      {kind === "DEPOSIT" &&
      selected === "OZOW" &&
      !providers.ozowConfigured ? (
        <p className="text-sm text-muted-foreground">{ozowNotConfiguredMessage}</p>
      ) : null}

      {!clientSecret && canPaySelected ? (
        <Button
          type="button"
          className="w-full justify-between"
          onClick={() => void startCheckout()}
          disabled={pending || !selected}
          aria-busy={pending}
        >
          <span className="flex items-center gap-2">
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : selected === "OZOW" ? (
              <Building2 className="size-4" aria-hidden />
            ) : (
              <CreditCard className="size-4" aria-hidden />
            )}
            {pending
              ? selected === "OZOW"
                ? "Opening Instant EFT…"
                : "Loading secure checkout…"
              : selected === "OZOW"
                ? `${label} · Instant EFT`
                : label}
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
