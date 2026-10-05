"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AdminPortalShell,
  AdminSearchTopbar,
} from "@/components/admin/AdminPortalShell";
import { FieldError } from "@/components/booking/FieldError";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  couponApiValue,
  couponCodeFieldError,
  couponFormFieldErrors,
  couponMaxRedemptionsFieldError,
  couponValueFieldError,
  couponWindowFieldError,
  formatCouponDiscount,
  formatCouponUses,
  formatCouponWindow,
  type CouponType,
} from "@/lib/coupon";
import { SERVICE_CITIES } from "@/types/user";

type CouponRow = {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  active: boolean;
  maxRedemptions: number | null;
  redeemedCount: number;
  validFrom: string | null;
  validTo: string | null;
  city: string | null;
};

type CouponFormField = "code" | "value" | "maxRedemptions" | "validFrom" | "validTo";

const ANY_CITY = "any";
const TABLE_COLS =
  "minmax(110px, 1.1fr) minmax(72px, 0.7fr) minmax(110px, 0.9fr) minmax(72px, 0.55fr) minmax(150px, 1.2fr) 88px 108px";

export default function AdminPricingPage() {
  const { user, ready } = useAuth();
  const isAdmin =
    user?.role === "admin" &&
    (user.adminTier === "full" || user.adminTier === "marketing-only");

  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Partial<Record<CouponFormField, boolean>>>(
    {}
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("PERCENT");
  const [value, setValue] = useState("");
  const [city, setCity] = useState<string>(ANY_CITY);
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [active, setActive] = useState(true);

  const markTouched = (field: CouponFormField) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const clearFieldError = (field: CouponFormField) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    if (formError) setFormError(null);
  };

  const liveError = (field: CouponFormField, validator: () => string | null) =>
    touched[field] || fieldErrors[field]
      ? fieldErrors[field] || validator()
      : null;

  const codeError = liveError("code", () => couponCodeFieldError(code));
  const valueError = liveError("value", () => couponValueFieldError(type, value));
  const maxError = liveError("maxRedemptions", () =>
    couponMaxRedemptionsFieldError(maxRedemptions)
  );
  const windowError = liveError("validTo", () =>
    couponWindowFieldError(validFrom, validTo)
  );

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/coupons", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not load coupons");
      }
      setCoupons(Array.isArray(data.coupons) ? data.coupons : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load coupons");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && isAdmin) void load();
    if (ready && !isAdmin) setLoading(false);
  }, [ready, isAdmin, load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return coupons;
    return coupons.filter((coupon) => coupon.code.toLowerCase().includes(needle));
  }, [coupons, query]);

  const toggleActive = async (coupon: CouponRow) => {
    const nextActive = !coupon.active;
    setBusyId(coupon.id);
    try {
      const res = await fetch(`/api/coupons/${coupon.id}`, {
        method: "PATCH",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not update coupon");
        return;
      }
      const saved =
        typeof data.coupon?.active === "boolean" ? data.coupon.active : nextActive;
      setCoupons((rows) =>
        rows.map((row) =>
          row.id === coupon.id ? { ...row, active: saved } : row
        )
      );
      toast.success(
        saved ? `${coupon.code} activated` : `${coupon.code} deactivated`
      );
    } catch {
      toast.error("Could not update coupon");
    } finally {
      setBusyId(null);
    }
  };

  const resetForm = () => {
    setCode("");
    setType("PERCENT");
    setValue("");
    setCity(ANY_CITY);
    setMaxRedemptions("");
    setValidFrom("");
    setValidTo("");
    setActive(true);
    setFormError(null);
    setFieldErrors({});
    setTouched({});
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nextErrors = couponFormFieldErrors({
      code,
      type,
      value,
      maxRedemptions,
      validFrom,
      validTo,
    });
    setFieldErrors(nextErrors);
    setTouched({
      code: true,
      value: true,
      maxRedemptions: true,
      validFrom: true,
      validTo: true,
    });
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    const maxRaw = maxRedemptions.trim();
    try {
      const res = await fetch("/api/coupons", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          type,
          value: couponApiValue(type, value),
          active,
          maxRedemptions: maxRaw === "" ? null : Number(maxRaw),
          validFrom: validFrom || null,
          validTo: validTo || null,
          city: city === ANY_CITY ? null : city,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof data.error === "string" ? data.error : "Could not create coupon";
        const lower = message.toLowerCase();
        if (lower.includes("already exists") || lower.includes("code")) {
          setFieldErrors({ code: message });
        } else if (
          lower.includes("percent") ||
          lower.includes("amount") ||
          lower.includes("value") ||
          lower.includes("discount")
        ) {
          setFieldErrors({ value: message });
        } else if (lower.includes("redemption")) {
          setFieldErrors({ maxRedemptions: message });
        } else if (lower.includes("valid")) {
          setFieldErrors({ validTo: message });
        } else {
          setFormError(message);
        }
        return;
      }
      const createdCode =
        typeof data.coupon?.code === "string" ? data.coupon.code : code.trim();
      setFormOpen(false);
      resetForm();
      toast.success(`Coupon ${createdCode} created`);
      await load();
    } catch {
      setFormError("Could not create coupon. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPortalShell
      pageTitle="Pricing & coupons"
      active="pricing"
      topbarActions={
        <AdminSearchTopbar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search by code"
          primaryAction={
            <Button
              type="button"
              onClick={() => setFormOpen(true)}
              disabled={!isAdmin}
              className="flex-none rounded-full px-[14px] py-[9px] text-[13px] font-extrabold"
            >
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              <span className="hidden sm:inline">Add new coupon</span>
              <span className="sm:hidden">Add</span>
            </Button>
          }
        />
      }
    >
      <div className="portal-page flex flex-col gap-[18px]">
        <div>
          <div
            className="flex items-center gap-2 text-eyebrow"
            style={{ color: "#9aa0a6" }}
          >
            <Tag size={14} strokeWidth={1.8} aria-hidden="true" />
            Coupon catalogue
          </div>
          <p className="text-meta mt-[6px]" style={{ color: "#9aa0a6" }}>
            Create a code checkout can look up. Percent off, or a fixed rand amount.
          </p>
        </div>

        {loadError ? (
          <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
            {loadError}{" "}
            <button type="button" className="ds-text-action" onClick={() => void load()}>
              Try again
            </button>
          </p>
        ) : null}

        <div className="ds-card overflow-hidden p-0">
          <CouponTable
            coupons={filtered}
            loading={loading}
            loadError={loadError}
            busyId={busyId}
            query={query}
            totalCount={coupons.length}
            onToggle={(coupon) => void toggleActive(coupon)}
          />
        </div>
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col gap-0 overflow-hidden sm:max-w-lg">
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => void handleCreate(e)}
            noValidate
          >
            <DialogHeader className="shrink-0 pr-8">
              <DialogTitle>Add new coupon</DialogTitle>
              <DialogDescription>
                Code is case-sensitive. Percent is 1–100. Fixed amounts are in rands.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
              <div className="space-y-1.5">
                <Label htmlFor="coupon-code">Code</Label>
                <Input
                  id="coupon-code"
                  name="code"
                  value={code}
                  placeholder="e.g. SPARK10"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={Boolean(codeError) || undefined}
                  aria-describedby={
                    codeError ? "coupon-code-error" : "coupon-code-hint"
                  }
                  onBlur={() => markTouched("code")}
                  onChange={(e) => {
                    setCode(e.target.value);
                    clearFieldError("code");
                  }}
                />
                {codeError ? (
                  <FieldError id="coupon-code-error" message={codeError} />
                ) : (
                  <p id="coupon-code-hint" className="text-[12px] text-[#9aa0a6]">
                    2–32 letters or numbers. Capitals are saved as typed.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coupon-type">Discount</Label>
                <Select
                  value={type}
                  onValueChange={(next) => {
                    setType(next as CouponType);
                    setValue("");
                    clearFieldError("value");
                  }}
                >
                  <SelectTrigger id="coupon-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Percent off</SelectItem>
                    <SelectItem value="FIXED_CENTS">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coupon-value">
                  {type === "PERCENT" ? "Percent" : "Amount (R)"}
                </Label>
                <Input
                  id="coupon-value"
                  name="value"
                  type="number"
                  inputMode="decimal"
                  min={type === "PERCENT" ? 1 : 0.01}
                  max={type === "PERCENT" ? 100 : undefined}
                  step={type === "PERCENT" ? 1 : 0.01}
                  value={value}
                  placeholder={type === "PERCENT" ? "10" : "50.00"}
                  aria-invalid={Boolean(valueError) || undefined}
                  aria-describedby={valueError ? "coupon-value-error" : undefined}
                  onBlur={() => markTouched("value")}
                  onChange={(e) => {
                    setValue(e.target.value);
                    clearFieldError("value");
                  }}
                />
                <FieldError id="coupon-value-error" message={valueError} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coupon-city">City</Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger id="coupon-city" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_CITY}>All cities</SelectItem>
                    {SERVICE_CITIES.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coupon-max">Max redemptions</Label>
                <Input
                  id="coupon-max"
                  name="maxRedemptions"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={maxRedemptions}
                  placeholder="Unlimited"
                  aria-invalid={Boolean(maxError) || undefined}
                  aria-describedby={
                    maxError ? "coupon-max-error" : "coupon-max-hint"
                  }
                  onBlur={() => markTouched("maxRedemptions")}
                  onChange={(e) => {
                    setMaxRedemptions(e.target.value);
                    clearFieldError("maxRedemptions");
                  }}
                />
                {maxError ? (
                  <FieldError id="coupon-max-error" message={maxError} />
                ) : (
                  <p id="coupon-max-hint" className="text-[12px] text-[#9aa0a6]">
                    Leave blank for unlimited uses.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="coupon-from">Valid from</Label>
                  <Input
                    id="coupon-from"
                    name="validFrom"
                    type="date"
                    value={validFrom}
                    onBlur={() => markTouched("validFrom")}
                    onChange={(e) => {
                      setValidFrom(e.target.value);
                      clearFieldError("validTo");
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="coupon-to">Valid to</Label>
                  <Input
                    id="coupon-to"
                    name="validTo"
                    type="date"
                    value={validTo}
                    aria-invalid={Boolean(windowError) || undefined}
                    aria-describedby={
                      windowError ? "coupon-window-error" : undefined
                    }
                    onBlur={() => markTouched("validTo")}
                    onChange={(e) => {
                      setValidTo(e.target.value);
                      clearFieldError("validTo");
                    }}
                  />
                </div>
              </div>
              <FieldError id="coupon-window-error" message={windowError} />

              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="coupon-active"
                  checked={active}
                  onCheckedChange={(checked) => setActive(checked === true)}
                />
                <Label htmlFor="coupon-active">Active</Label>
              </div>

              {formError ? (
                <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
                  {formError}
                </p>
              ) : null}
            </div>
            <DialogFooter className="mt-5 shrink-0">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !isAdmin}>
                {saving ? "Creating…" : "Create coupon"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminPortalShell>
  );
}

function CouponTable({
  coupons,
  loading,
  loadError,
  busyId,
  query,
  totalCount,
  onToggle,
}: {
  coupons: CouponRow[];
  loading: boolean;
  loadError: string | null;
  busyId: string | null;
  query: string;
  totalCount: number;
  onToggle: (coupon: CouponRow) => void;
}) {
  const showEmpty = !loading && !loadError && totalCount === 0;
  const showNoMatch =
    !loading && !loadError && totalCount > 0 && coupons.length === 0;

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <div className="min-w-[760px]">
          <div
            className="grid items-center px-[22px] py-[14px]"
            style={{
              gridTemplateColumns: TABLE_COLS,
              background: "#f7f9fb",
              borderBottom: "1px solid #f0f2f6",
              columnGap: 16,
            }}
          >
            {["Code", "Discount", "City", "Uses", "Dates", "Status", "Actions"].map(
              (heading) => (
                <div
                  key={heading}
                  className={heading === "Actions" ? "text-th text-right" : "text-th"}
                >
                  {heading}
                </div>
              )
            )}
          </div>
          {coupons.map((coupon) => (
            <div
              key={coupon.id || coupon.code}
              className="grid items-center px-[22px] py-[12px] transition-colors hover:bg-[#fafbfc]"
              style={{
                gridTemplateColumns: TABLE_COLS,
                borderBottom: "1px solid #f0f2f6",
                columnGap: 16,
              }}
            >
              <div
                className="min-w-0 truncate text-body font-bold"
                style={{ color: "#000b49" }}
                title={coupon.code}
              >
                {coupon.code}
              </div>
              <div className="text-body" style={{ color: "#32373c" }}>
                {formatCouponDiscount(coupon.type, coupon.value)}
              </div>
              <div
                className="min-w-0 truncate text-body"
                style={{ color: "#32373c" }}
              >
                {coupon.city ?? "All cities"}
              </div>
              <Uses coupon={coupon} />
              <div className="text-body" style={{ color: "#32373c" }}>
                {formatCouponWindow(coupon.validFrom, coupon.validTo)}
              </div>
              <StatusPill active={coupon.active} />
              <ToggleCoupon
                coupon={coupon}
                busy={busyId === coupon.id}
                onToggle={onToggle}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="lg:hidden">
        {coupons.map((coupon) => (
          <div
            key={coupon.id || coupon.code}
            className="border-b border-[#f0f2f6] px-[16px] py-[14px]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div
                  className="truncate text-[15px] font-bold"
                  style={{ color: "#000b49" }}
                >
                  {coupon.code}
                </div>
                <div className="text-body mt-[4px]" style={{ color: "#32373c" }}>
                  {formatCouponDiscount(coupon.type, coupon.value)}
                  {" · "}
                  {coupon.city ?? "All cities"}
                </div>
              </div>
              <StatusPill active={coupon.active} />
            </div>
            <div className="mt-[8px] flex items-center justify-between gap-3">
              <div className="text-meta" style={{ color: "#9aa0a6" }}>
                <Uses coupon={coupon} />
                {" · "}
                {formatCouponWindow(coupon.validFrom, coupon.validTo)}
              </div>
              <ToggleCoupon
                coupon={coupon}
                busy={busyId === coupon.id}
                onToggle={onToggle}
              />
            </div>
          </div>
        ))}
      </div>

      {loading && totalCount === 0 && !loadError ? (
        <div
          className="px-[22px] py-[40px] text-center text-meta"
          style={{ color: "#9aa0a6" }}
          role="status"
        >
          Loading coupons…
        </div>
      ) : null}

      {showEmpty ? (
        <div
          className="px-[22px] py-[40px] text-center text-meta"
          style={{ color: "#9aa0a6" }}
        >
          No coupons yet. Add a code to use at checkout.
        </div>
      ) : null}

      {showNoMatch ? (
        <div
          className="px-[22px] py-[40px] text-center text-meta"
          style={{ color: "#9aa0a6" }}
        >
          No coupons match “{query.trim()}”.
        </div>
      ) : null}
    </>
  );
}

function Uses({ coupon }: { coupon: CouponRow }) {
  return (
    <span className="text-body" style={{ color: "#32373c" }}>
      {formatCouponUses(coupon.redeemedCount, coupon.maxRedemptions)}
    </span>
  );
}

function ToggleCoupon({
  coupon,
  busy,
  onToggle,
}: {
  coupon: CouponRow;
  busy: boolean;
  onToggle: (coupon: CouponRow) => void;
}) {
  if (coupon.active) {
    return (
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={busy}
        aria-label={`Deactivate ${coupon.code}`}
        className="h-8 justify-self-end rounded-[8px] bg-[#fff0f0] px-3 text-[12px] font-bold text-[#d64545] hover:bg-[#d64545] hover:text-white"
        onClick={() => onToggle(coupon)}
      >
        {busy ? "Saving…" : "Deactivate"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      disabled={busy}
      aria-label={`Activate ${coupon.code}`}
      className="h-8 justify-self-end rounded-[8px] bg-[#eafaf5] px-3 text-[12px] font-bold text-[#0a7a63] hover:bg-[#0a7a63] hover:text-white"
      onClick={() => onToggle(coupon)}
    >
      {busy ? "Saving…" : "Activate"}
    </Button>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex w-fit rounded-full px-[10px] py-[5px] text-[10px] font-extrabold tracking-wide"
      style={
        active
          ? { background: "#eafaf5", color: "#0a7a63" }
          : { background: "#fdecec", color: "#b33232" }
      }
    >
      {active ? "ACTIVE" : "INACTIVE"}
    </span>
  );
}
