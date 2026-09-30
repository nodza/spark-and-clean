"use client";

import { useCallback, useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPortalShell } from "@/components/admin/AdminPortalShell";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  formatCouponDiscount,
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

const ANY_CITY = "any";

const selectClass =
  "h-auto w-full rounded-[10px] border-[1.5px] border-[#dfe2e7] px-[13px] py-[13px] text-[14.5px] text-[#32373c] shadow-none";

export default function AdminPricingPage() {
  const { user, ready } = useAuth();
  const isAdmin =
    user?.role === "admin" &&
    (user.adminTier === "full" || user.adminTier === "marketing-only");

  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("PERCENT");
  const [value, setValue] = useState("");
  const [city, setCity] = useState<string>(ANY_CITY);
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [active, setActive] = useState(true);

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
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    const numeric = Number(value);
    const apiValue =
      type === "PERCENT" ? numeric : Math.round(numeric * 100);
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
          value: apiValue,
          active,
          maxRedemptions: maxRaw === "" ? null : Number(maxRaw),
          validFrom: validFrom || null,
          validTo: validTo || null,
          city: city === ANY_CITY ? null : city,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error || "Could not create coupon");
        return;
      }
      const createdCode =
        typeof data.coupon?.code === "string" ? data.coupon.code : code.trim();
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
    <AdminPortalShell pageTitle="Pricing & coupons" active="pricing">
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

        <div className="flex flex-col gap-[18px] xl:flex-row xl:items-start">
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="ds-card w-full space-y-3 xl:max-w-[380px] xl:flex-none"
          >
            <div
              className="text-[16px] font-extrabold"
              style={{ color: "#000b49" }}
            >
              New coupon
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="coupon-code">Code</Label>
              <Input
                id="coupon-code"
                name="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. SPARK10"
                autoComplete="off"
                spellCheck={false}
                required
                aria-invalid={formError ? true : undefined}
                aria-describedby="coupon-code-hint"
              />
              <p id="coupon-code-hint" className="text-meta" style={{ color: "#9aa0a6" }}>
                Capitals are saved as typed.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="coupon-type">Discount</Label>
              <Select
                value={type}
                onValueChange={(next) => {
                  setType(next as CouponType);
                  setValue("");
                }}
              >
                <SelectTrigger id="coupon-type" className={selectClass}>
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
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === "PERCENT" ? "10" : "50.00"}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="coupon-city">City</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger id="coupon-city" className={selectClass}>
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
                onChange={(e) => setMaxRedemptions(e.target.value)}
                placeholder="Unlimited"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="coupon-from">Valid from</Label>
                <Input
                  id="coupon-from"
                  name="validFrom"
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coupon-to">Valid to</Label>
                <Input
                  id="coupon-to"
                  name="validTo"
                  type="date"
                  value={validTo}
                  onChange={(e) => setValidTo(e.target.value)}
                />
              </div>
            </div>

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

            <Button type="submit" disabled={saving || !isAdmin}>
              {saving ? "Creating…" : "Create coupon"}
            </Button>
          </form>

          <div className="ds-card min-w-0 flex-1 overflow-hidden p-0">
            {loadError ? (
              <div className="flex items-center justify-between gap-3 px-[22px] py-[14px]">
                <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
                  {loadError}
                </p>
                <button
                  type="button"
                  className="ds-text-action"
                  onClick={() => void load()}
                >
                  Try again
                </button>
              </div>
            ) : null}

            <CouponTable
              coupons={coupons}
              loading={loading}
              loadError={loadError}
              busyId={busyId}
              onToggle={(coupon) => void toggleActive(coupon)}
            />
          </div>
        </div>
      </div>
    </AdminPortalShell>
  );
}

function CouponTable({
  coupons,
  loading,
  loadError,
  busyId,
  onToggle,
}: {
  coupons: CouponRow[];
  loading: boolean;
  loadError: string | null;
  busyId: string | null;
  onToggle: (coupon: CouponRow) => void;
}) {
  const showEmpty = !loading && !loadError && coupons.length === 0;

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <div className="min-w-[760px]">
          <div
            className="grid items-center px-[22px] py-[14px]"
            style={{
              gridTemplateColumns:
                "minmax(100px, 1fr) minmax(72px, 0.7fr) minmax(100px, 0.8fr) minmax(72px, 0.6fr) minmax(150px, 1.1fr) 72px 96px",
              background: "#f7f9fb",
              borderBottom: "1px solid #f0f2f6",
              columnGap: 16,
            }}
          >
            <div className="text-th">Code</div>
            <div className="text-th">Discount</div>
            <div className="text-th">City</div>
            <div className="text-th">Uses</div>
            <div className="text-th">Dates</div>
            <div className="text-th">Status</div>
            <div className="text-th text-right"> </div>
          </div>
          {coupons.map((coupon) => (
            <div
              key={coupon.id || coupon.code}
              className="grid items-center px-[22px] py-[12px]"
              style={{
                gridTemplateColumns:
                  "minmax(100px, 1fr) minmax(72px, 0.7fr) minmax(100px, 0.8fr) minmax(72px, 0.6fr) minmax(150px, 1.1fr) 72px 96px",
                borderBottom: "1px solid #f0f2f6",
                columnGap: 16,
              }}
            >
              <div
                className="min-w-0 truncate text-body font-extrabold tracking-wide"
                style={{ color: "#000b49" }}
              >
                {coupon.code}
              </div>
              <div className="text-body" style={{ color: "#32373c" }}>
                {formatCouponDiscount(coupon.type, coupon.value)}
              </div>
              <div className="min-w-0 truncate text-body" style={{ color: "#32373c" }}>
                {coupon.city ?? "All cities"}
              </div>
              <Uses coupon={coupon} />
              <div className="text-meta" style={{ color: "#32373c" }}>
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
              <div>
                <div
                  className="text-[15px] font-extrabold tracking-wide"
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

      {loading && coupons.length === 0 && !loadError ? (
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
          No coupons yet. Create a code to use at checkout.
        </div>
      ) : null}
    </>
  );
}

function Uses({ coupon }: { coupon: CouponRow }) {
  return (
    <span className="text-body" style={{ color: "#32373c" }}>
      {coupon.redeemedCount}
      <span className="text-meta" style={{ color: "#9aa0a6" }}>
        {coupon.maxRedemptions == null
          ? " used"
          : ` / ${coupon.maxRedemptions}`}
      </span>
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
  return (
    <button
      type="button"
      className="ds-text-action justify-self-end disabled:opacity-60"
      disabled={busy}
      aria-label={
        coupon.active ? `Deactivate ${coupon.code}` : `Activate ${coupon.code}`
      }
      onClick={() => onToggle(coupon)}
    >
      {busy ? "Saving…" : coupon.active ? "Deactivate" : "Activate"}
    </button>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-extrabold"
      style={{
        background: active ? "#eafaf5" : "#f4f5f7",
        color: active ? "#0a7a63" : "#9aa0a6",
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}
