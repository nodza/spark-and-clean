"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { AccessDeniedBanner } from "@/components/auth/AccessDeniedBanner";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRequireClientAuth } from "@/hooks/useRequireClientAuth";
import { cn } from "@/lib/utils";

type PaymentRow = {
  id: string;
  createdAt: string;
  bookingId: string;
  kind: string;
  amountCents: number;
  currency: string;
  provider: string;
  status: string;
};

function formatRand(cents: number) {
  const amount = new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `R ${amount.replace(/\u00a0/g, " ")}`;
}

function formatPaymentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "dd MMM yyyy · HH:mm");
}

function providerLabel(provider: string) {
  const value = provider.trim().toLowerCase();
  if (value === "stripe") return "Stripe";
  if (value === "ozow") return "Ozow";
  if (!value) return "—";
  return provider;
}

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  const value = status.toUpperCase();
  if (value === "SUCCEEDED") return "default";
  if (value === "PENDING") return "secondary";
  if (value === "FAILED") return "destructive";
  return "outline";
}

export default function ClientPaymentsPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const { user, email, ready } = useRequireClientAuth();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = user?.name?.trim() || email;

  const loadPayments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments", { credentials: "include" });
      const data = (await res.json().catch(() => null)) as {
        payments?: PaymentRow[];
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Could not load payment history.");
      }
      setPayments(Array.isArray(data?.payments) ? data.payments : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load payment history."
      );
      setPayments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !email) return;
    void loadPayments();
  }, [ready, email, loadPayments]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (!ready || !email) return null;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <Suspense fallback={null}>
        <AccessDeniedBanner />
      </Suspense>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2">
            <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
              <Link href="/portal">
                <ArrowLeft className="mr-1 h-4 w-4" />
                My Bookings
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Payment history</h1>
          <p className="text-muted-foreground">Welcome back, {displayName}</p>
          <div className="mt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => void loadPayments(true)}
              disabled={refreshing}
              aria-label="Refresh payments"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void handleLogout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
          <Button asChild variant="outline">
            <Link href="/portal">My Bookings</Link>
          </Button>
        </div>
      </div>

      {error ? (
        <p
          className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <div
          className="flex flex-col items-center justify-center gap-3 py-16 text-center"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading your payments…</p>
        </div>
      ) : payments.length === 0 ? (
        <Card className="border-dashed bg-secondary/10">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <CreditCard className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-muted-foreground">No payments yet.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border bg-white md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-secondary/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Booking</th>
                  <th className="px-4 py-3 font-semibold">Kind</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Provider</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b last:border-b-0 hover:bg-secondary/10"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatPaymentDate(payment.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/booking/${payment.bookingId}`}
                        className="font-medium text-primary underline-offset-2 hover:underline break-all"
                      >
                        {payment.bookingId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{payment.kind}</td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {formatRand(payment.amountCents)}
                    </td>
                    <td className="px-4 py-3">{providerLabel(payment.provider)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadgeVariant(payment.status)}>
                        {payment.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {payments.map((payment) => (
              <Card key={payment.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/booking/${payment.bookingId}`}
                      className="font-semibold text-primary underline-offset-2 hover:underline break-all"
                    >
                      {payment.bookingId}
                    </Link>
                    <Badge variant={statusBadgeVariant(payment.status)}>
                      {payment.status}
                    </Badge>
                  </div>
                  <p className="text-lg font-bold tabular-nums">
                    {formatRand(payment.amountCents)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {payment.kind} · {providerLabel(payment.provider)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatPaymentDate(payment.createdAt)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
