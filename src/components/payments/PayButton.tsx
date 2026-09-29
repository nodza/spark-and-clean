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
 * paymentStatus — webhooks / Ozow notify record the transfer via the ledger.
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
  } | null>(null);
  const [selected, setSelected] = useState<PayProvider | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const onPaidRef = useRef(onPaid);
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
        const stripe = Boolean(data?.stripe);
        const ozow = Boolean(data?.ozow) && (kind === "DEPOSIT" || kind === "BALANCE");
        // Stripe is deposit-only today
        const stripeOk = stripe && kind === "DEPOSIT";
        setProviders({ stripe: stripeOk, ozow });
        if (stripeOk && !ozow) setSelected("STRIPE");
        else if (ozow && !stripeOk) setSelected("OZOW");
        else if (stripeOk) setSelected("STRIPE");
        else if (ozow) setSelected("OZOW");
      })
      .catch(() => {
        if (!cancelled) setProviders({ stripe: false, ozow: false });
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/payments/sync-session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | { paymentStatus?: string }
          | null;
        if (
          !cancelled &&
          res.ok &&
          data?.paymentStatus &&
          data.paymentStatus !== "UNPAID" &&
          (kind === "DEPOSIT"
            ? data.paymentStatus !== "UNPAID"
            : data.paymentStatus === "PAID")
        ) {
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
            if (message) {
              setError(message);
              setConfirming(false);
              return;
            }

            const sync = await fetch("/api/payments/sync-session", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bookingId, clientSecret }),
            });
            const synced = (await sync.json().catch(() => null)) as
              | { paymentStatus?: string; error?: string }
              | null;
            setConfirming(false);
            if (!sync.ok) {
              setError(
                synced?.error ||
                  "Payment went through, but the booking status did not update. Refresh in a moment."
              );
              return;
            }
            onPaidRef.current?.();
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
  }, [bookingId, clientSecret]);

  async function startCheckout() {
    if (pending || clientSecret || amountCents < 1 || !selected) return;
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

  if (amountCents < 1) {
    return (
      <p className="text-sm text-muted-foreground">
        {kind === "BALANCE"
          ? "There is no remaining balance on this booking."
          : "There is nothing to collect as a deposit on this booking yet."}
      </p>
    );
  }

  if (providers && !providers.stripe && !providers.ozow) {
    return (
      <p className="text-sm text-muted-foreground">
        Online payments are not available right now.
      </p>
    );
  }

  const label =
    kind === "BALANCE"
      ? `Pay R ${formatRand(amountCents)} balance`
      : `Pay R ${formatRand(amountCents)} deposit`;

  const showChooser =
    Boolean(providers?.stripe && providers?.ozow) && !clientSecret;

  return (
    <div className="space-y-3">
      {showChooser ? (
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Payment method">
          <button
            type="button"
            onClick={() => setSelected("STRIPE")}
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
          <button
            type="button"
            onClick={() => setSelected("OZOW")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold",
              selected === "OZOW"
                ? "border-navy bg-navy text-white"
                : "border-[#e3e7ed] bg-white text-navy hover:bg-[#f5f7fa]"
            )}
          >
            <Building2 className="size-3.5" aria-hidden />
            Instant EFT
          </button>
        </div>
      ) : null}

      {!clientSecret ? (
        <Button
          type="button"
          className="w-full justify-between"
          onClick={() => void startCheckout()}
          disabled={pending || !selected || providers === null}
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
