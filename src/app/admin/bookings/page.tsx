"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Pencil, Trash2 } from "lucide-react";
import { useBookingsLiveList } from "@/hooks/useBookingsLiveList";
import {
  bookingCalendarDate,
  formatBookingCollection,
} from "@/lib/localCalendarDate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  CallAction,
  driverProfileHref,
} from "@/components/admin/CallAction";
import { InactiveDriverBadge } from "@/components/admin/InactiveDriverBadge";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import { BookingsFilterPanel } from "@/components/admin/BookingsFilterPanel";
import {
  AdminPortalShell,
  AdminSearchTopbar,
} from "@/components/admin/AdminPortalShell";
import {
  bookingStatusVariant,
  paymentStatusVariant,
} from "@/components/admin/bookingBadges";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  applyBookingListQuery,
  bookingFiltersToSearchParams,
  countBookingsByStatus,
  EMPTY_BOOKING_FILTERS,
  parseBookingListQuery,
  type AdminBookingFilters,
} from "@/lib/adminBookingQuery";
import {
  bookingDeleteBlockReason,
  canDeleteBooking,
} from "@/lib/adminBookingDetails";
import { isUnassignedDriver } from "@/lib/bookingAttention";
import {
  applyListPaginationParams,
  DEFAULT_LIST_PAGINATION,
  paginateList,
  parseListPagination,
  type ListPagination,
  type PageSize,
} from "@/lib/listPagination";
import { SERVICE_CITIES } from "@/types/user";
import type { Booking, Driver } from "@/types/booking";
import { compactVehicleFromDisplay } from "@/lib/vehicle";

const TABLE_COLS_BASE =
  "minmax(140px, 1.05fr) minmax(150px, 1.45fr) minmax(60px, 0.4fr) minmax(88px, 0.65fr) minmax(110px, 0.8fr) minmax(72px, 0.5fr) minmax(84px, 0.6fr)";
const TABLE_COLS_WITH_ACTIONS = `${TABLE_COLS_BASE} 88px`;

type EditFormState = {
  name: string;
  phone: string;
  email: string;
  addressLine1: string;
  suburb: string;
  city: string;
  collectionDate: string;
  collectionSlot: "MORNING" | "AFTERNOON";
};

function emptyEditForm(): EditFormState {
  return {
    name: "",
    phone: "",
    email: "",
    addressLine1: "",
    suburb: "",
    city: SERVICE_CITIES[0],
    collectionDate: "",
    collectionSlot: "MORNING",
  };
}

function editFormFromBooking(booking: Booking): EditFormState {
  const city = SERVICE_CITIES.includes(
    booking.city as (typeof SERVICE_CITIES)[number]
  )
    ? booking.city
    : SERVICE_CITIES[0];
  return {
    name: booking.customer.name || "",
    phone: booking.customer.phone || "",
    email: booking.customer.email || "",
    addressLine1: booking.addressLine1 || "",
    suburb: booking.suburb || "",
    city,
    collectionDate:
      bookingCalendarDate(booking.collectionDate) ||
      booking.collectionDate.slice(0, 10),
    collectionSlot:
      booking.collectionSlot === "AFTERNOON" ? "AFTERNOON" : "MORNING",
  };
}

function stopRowNavigation(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
  if ("nativeEvent" in event && event.nativeEvent instanceof Event) {
    event.nativeEvent.stopImmediatePropagation();
  }
}

function formatRand(amount: number) {
  const rounded = Math.round(amount);
  return `R${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
}

function bookingValue(booking: Booking) {
  return (booking.estimatedPriceMin + booking.estimatedPriceMax) / 2;
}

function collectionLabel(booking: Booking) {
  const date = formatBookingCollection(booking.collectionDate, "d MMM");
  const time = booking.collectionSlot === "MORNING" ? "09:00" : "14:00";
  return `${date} · ${time}`;
}

function clientAddressLine(booking: Booking) {
  const street = booking.addressLine1?.trim() || "";
  const city = booking.city?.trim() || "";
  if (street && city) return `${street}, ${city}`;
  return street || city || booking.suburb;
}

function bookingShareUrl(bookingId: string) {
  return new URL(`/admin/bookings/${bookingId}`, window.location.origin).href;
}

function CopyBookingLinkButton({ bookingId }: { bookingId: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(bookingShareUrl(bookingId));
      setCopied(true);
      toast.success("Booking link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <button
      type="button"
      aria-label={`Copy link to booking ${bookingId}`}
      title="Copy booking link"
      className="relative z-[2] inline-flex size-7 flex-none items-center justify-center rounded-[7px] text-[#0a7a63] transition-colors hover:bg-[#eafaf5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000b49]"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation();
        void copyLink();
      }}
    >
      {copied ? (
        <Check size={13} strokeWidth={2.4} aria-hidden />
      ) : (
        <Copy size={13} strokeWidth={2.2} aria-hidden />
      )}
    </button>
  );
}

export default function AdminBookingsPage() {
  return (
    <Suspense fallback={<BookingsShellFallback />}>
      <AdminBookingsList />
    </Suspense>
  );
}

function BookingsShellFallback() {
  return (
    <AdminPortalShell
      pageTitle="Bookings"
      active="bookings"
      topbarActions={<AdminSearchTopbar />}
    >
      <div className="portal-page text-meta" style={{ color: "#9aa0a6" }}>
        Loading bookings…
      </div>
    </AdminPortalShell>
  );
}

function AdminBookingsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isFullAdmin = user?.role === "admin" && user.adminTier === "full";
  const {
    bookings,
    loading: isLoading,
    error,
    refresh,
  } = useBookingsLiveList(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(emptyEditForm);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Booking | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function openEdit(booking: Booking) {
    setEditing(booking);
    setEditForm(editFormFromBooking(booking));
    setEditError(null);
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setEditError(null);
    try {
      const response = await fetch(
        `/api/admin/bookings/${encodeURIComponent(editing.id)}/details`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer: {
              name: editForm.name,
              phone: editForm.phone,
              email: editForm.email,
            },
            addressLine1: editForm.addressLine1,
            suburb: editForm.suburb,
            city: editForm.city,
            collectionDate: editForm.collectionDate,
            collectionSlot: editForm.collectionSlot,
          }),
        }
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not save booking details");
      }
      toast.success("Booking details updated");
      setEditing(null);
      await refresh();
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Could not save booking details"
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      const response = await fetch(
        `/api/admin/bookings/${encodeURIComponent(deleting.id)}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not delete booking");
      }
      toast.success(`Deleted ${deleting.id}`);
      setDeleting(null);
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete booking"
      );
    } finally {
      setBusyId(null);
    }
  }

  function rowActions(booking: Booking) {
    const deleteReason = bookingDeleteBlockReason(booking);
    const deleteAllowed = canDeleteBooking(booking);
    const disabled = busyId === booking.id;
    const reasonId = `delete-blocked-${booking.id}`;
    return (
      <div
        className="relative z-[2] flex flex-col items-end gap-1"
        onPointerDown={stopRowNavigation}
        onKeyDown={stopRowNavigation}
        onClick={stopRowNavigation}
      >
        <div className="flex items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={disabled}
            aria-label={`Edit booking ${booking.id}`}
            title="Edit booking details"
            className="rounded-[8px] border-[#e3e7ed] text-[#000b49] hover:border-[#000b49] hover:bg-[#f7f9fb]"
            onClick={() => openEdit(booking)}
          >
            <Pencil size={15} strokeWidth={2} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            disabled={disabled || !deleteAllowed}
            aria-label={
              deleteAllowed
                ? `Delete booking ${booking.id}`
                : `Delete unavailable: ${deleteReason}`
            }
            aria-describedby={!deleteAllowed ? reasonId : undefined}
            title={
              deleteAllowed ? "Delete booking" : deleteReason || "Cannot delete"
            }
            className="rounded-[8px] bg-[#fff0f0] text-[#d64545] hover:bg-[#d64545] hover:text-white disabled:bg-[#f5f7fa] disabled:text-[#9aa0a6]"
            onClick={() => {
              if (!deleteAllowed) return;
              setDeleting(booking);
            }}
          >
            <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
          </Button>
        </div>
        {!deleteAllowed && deleteReason ? (
          <p
            id={reasonId}
            className="max-w-[148px] text-right text-[10px] leading-snug text-[#9aa0a6]"
          >
            {deleteReason}
          </p>
        ) : null}
      </div>
    );
  }

  const filters = useMemo(
    () => parseBookingListQuery(searchParams),
    [searchParams]
  );
  const pagination = useMemo(
    () => parseListPagination(searchParams),
    [searchParams]
  );

  useEffect(() => {
    void fetch("/api/drivers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDrivers(data);
      })
      .catch(() => setDrivers([]));
  }, []);

  const driverName = useMemo(() => {
    const map = new Map(drivers.map((d) => [d.id, d.name]));
    return (id?: string) => {
      if (isUnassignedDriver(id)) return "Unassigned";
      return (id && map.get(id)) || null;
    };
  }, [drivers]);

  const driverVehicle = useMemo(() => {
    const map = new Map(drivers.map((d) => [d.id, d.vehicle]));
    return (id?: string) => (id ? map.get(id) : undefined);
  }, [drivers]);

  const isKnownDriver = useMemo(() => {
    const ids = new Set(drivers.map((d) => d.id));
    return (id?: string) => Boolean(id && ids.has(id));
  }, [drivers]);

  const driverPhone = useMemo(() => {
    const map = new Map(
      drivers.map((d) => [
        d.id,
        typeof d.phone === "string" && d.phone.trim() ? d.phone.trim() : undefined,
      ])
    );
    return (id?: string) => (id ? map.get(id) : undefined);
  }, [drivers]);

  const suburbs = useMemo(
    () => [...new Set(bookings.map((b) => b.suburb))].sort((a, b) => a.localeCompare(b)),
    [bookings]
  );
  const cities = useMemo(
    () => [...new Set(bookings.map((b) => b.city))].sort((a, b) => a.localeCompare(b)),
    [bookings]
  );

  const rows = useMemo(
    () => applyBookingListQuery(bookings, filters),
    [bookings, filters]
  );
  const statusCounts = useMemo(
    () => countBookingsByStatus(bookings, filters),
    [bookings, filters]
  );

  const paged = useMemo(
    () => paginateList(rows, pagination),
    [rows, pagination]
  );
  const pageItems = paged.items;

  function writeListUrl(
    nextFilters: AdminBookingFilters,
    nextPagination: ListPagination
  ) {
    const params = bookingFiltersToSearchParams(nextFilters);
    applyListPaginationParams(params, nextPagination);
    const qs = params.toString();
    router.replace(qs ? `/admin/bookings?${qs}` : "/admin/bookings", {
      scroll: false,
    });
  }

  function replaceFilters(next: AdminBookingFilters) {
    writeListUrl(next, { page: 1, limit: pagination.limit });
  }

  function patchFilters(patch: Partial<AdminBookingFilters>) {
    replaceFilters({ ...filters, ...patch });
  }

  function setPage(page: number) {
    writeListUrl(filters, { page, limit: pagination.limit });
  }

  function setLimit(limit: PageSize) {
    writeListUrl(filters, { page: 1, limit });
  }

  const highlightUnassigned = filters.assigned === "0";
  const tableCols = isFullAdmin ? TABLE_COLS_WITH_ACTIONS : TABLE_COLS_BASE;

  return (
    <AdminPortalShell
      pageTitle="Bookings"
      active="bookings"
      bookingsBadge={bookings.length || undefined}
      topbarActions={
        <AdminSearchTopbar
          searchValue={filters.q}
          onSearchChange={(q) => patchFilters({ q })}
          searchPlaceholder="Search by ID, name, phone, email, or address"
        />
      }
    >
      <div className="portal-page flex flex-col gap-[18px]">
        <BookingsFilterPanel
          filters={filters}
          matchedCount={rows.length}
          totalCount={bookings.length}
          statusCounts={statusCounts}
          cities={cities}
          suburbs={suburbs}
          onPatch={patchFilters}
          onClear={() =>
            writeListUrl({ ...EMPTY_BOOKING_FILTERS }, DEFAULT_LIST_PAGINATION)
          }
        />

        <div className="ds-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <div className="w-full">
              <div
                className="hidden px-[16px] py-[11px] lg:grid lg:items-center xl:px-[18px]"
                style={{
                  gridTemplateColumns: tableCols,
                  background: "#f7f9fb",
                  borderBottom: "1px solid #f0f2f6",
                  columnGap: 13,
                }}
              >
                {[
                  "REF",
                  "CLIENT",
                  "VALUE",
                  "COLLECTION",
                  "DRIVER",
                  "PAYMENT",
                  "STATUS",
                  ...(isFullAdmin ? ["ACTIONS"] : []),
                ].map((h) => (
                  <div
                    key={h}
                    className={`text-th${h === "ACTIONS" ? " text-right" : ""}`}
                  >
                    {h === "ACTIONS" ? "Actions" : h}
                  </div>
                ))}
              </div>

              {isLoading && bookings.length === 0 ? (
                <div
                  className="px-[22px] py-[48px] text-center text-meta"
                  style={{ color: "#9aa0a6" }}
                  role="status"
                >
                  Loading bookings…
                </div>
              ) : null}

              {error && bookings.length === 0 ? (
                <div
                  className="px-[22px] py-[48px] text-center text-meta"
                  style={{ color: "#b3261e" }}
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              {!isLoading && !error && bookings.length === 0 ? (
                <div
                  className="px-[22px] py-[48px] text-center text-meta"
                  style={{ color: "#9aa0a6" }}
                >
                  No bookings yet.
                </div>
              ) : null}

              {!isLoading && bookings.length > 0 && rows.length === 0 ? (
                <div
                  className="px-[22px] py-[48px] text-center text-meta"
                  style={{ color: "#9aa0a6" }}
                >
                  No bookings match these filters
                  {filters.q ? ` for “${filters.q}”` : ""}.
                </div>
              ) : null}

              {pageItems.map((booking) => {
                const unassigned = isUnassignedDriver(booking.assignedDriverId);
                const knownDriver = isKnownDriver(booking.assignedDriverId);
                const inactive = !unassigned && !knownDriver;
                const knownName = driverName(booking.assignedDriverId);
                const driverLabel = unassigned
                  ? "Unassigned"
                  : inactive
                    ? "Assigned driver"
                    : knownName || "Assigned driver";
                const vehicleRaw = knownDriver
                  ? driverVehicle(booking.assignedDriverId)
                  : undefined;
                const vehicleLabel =
                  typeof vehicleRaw === "string" && vehicleRaw.trim()
                    ? compactVehicleFromDisplay(vehicleRaw)
                    : "";
                return (
                  <div
                    key={booking.id}
                    className="group relative border-b border-[#f0f2f6] transition-colors duration-150 hover:bg-[#f7f9fb]"
                    style={{
                      background:
                        highlightUnassigned && unassigned
                          ? "rgba(255, 220, 57, 0.18)"
                          : undefined,
                    }}
                  >
                    <Link
                      href={`/admin/bookings/${booking.id}`}
                      className="absolute inset-0 z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#000b49]"
                      aria-label={`Open booking ${booking.id}`}
                    />
                    <div
                      className="flex w-full flex-col gap-3 px-[16px] py-[14px] sm:px-[18px] lg:grid lg:items-center lg:gap-0 lg:py-[16px]"
                      style={{
                        gridTemplateColumns: tableCols,
                        columnGap: 12,
                      }}
                    >
                    <div className="flex items-center justify-between gap-3 lg:contents">
                      <div className="flex min-w-0 items-center gap-[6px]">
                        <CopyBookingLinkButton bookingId={booking.id} />
                        <div
                          className="min-w-0 truncate text-[11px] font-bold leading-none tracking-[0.02em] tabular-nums underline-offset-2 group-hover:underline"
                          style={{ color: "#0a7a63" }}
                          title={booking.id}
                        >
                          {booking.id}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 lg:hidden">
                        <Badge variant={bookingStatusVariant(booking.status)}>
                          {booking.status}
                        </Badge>
                        {isFullAdmin ? rowActions(booking) : null}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div
                        className="truncate text-[14px] font-bold leading-snug"
                        style={{ color: "#000b49" }}
                      >
                        {booking.customer.name}
                      </div>
                      {clientAddressLine(booking) ? (
                        <div
                          className="mt-[3px] truncate text-[12px] leading-snug"
                          style={{ color: "#9aa0a6" }}
                          title={clientAddressLine(booking)}
                        >
                          {clientAddressLine(booking)}
                        </div>
                      ) : null}
                    </div>

                    <div
                      className="text-[12px] font-semibold tabular-nums"
                      style={{ color: "#000b49" }}
                    >
                      {formatRand(bookingValue(booking))}
                    </div>

                    <div
                      className="truncate text-[12px] font-medium tabular-nums"
                      style={{ color: "#6b7280" }}
                      title={collectionLabel(booking)}
                    >
                      {collectionLabel(booking)}
                    </div>

                    <div className="relative z-[2] min-w-0">
                      {inactive ? (
                        <InactiveDriverBadge className="px-[8px] py-[3px] text-[10px]" />
                      ) : (
                        <>
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span
                              className="min-w-0 truncate text-[12px] font-medium leading-snug"
                              style={{
                                color: unassigned ? "#b3261e" : "#000b49",
                              }}
                              title={driverLabel}
                            >
                              {driverLabel}
                            </span>
                            {!unassigned ? (
                              <CallAction
                                compact
                                label="Call driver"
                                phone={driverPhone(booking.assignedDriverId)}
                                disabledReason="No number on profile"
                                profileHref={
                                  booking.assignedDriverId
                                    ? driverProfileHref(booking.assignedDriverId)
                                    : undefined
                                }
                              />
                            ) : null}
                          </div>
                          {vehicleLabel ? (
                            <div
                              className="mt-[3px] truncate text-[12px] leading-snug"
                              style={{ color: "#9aa0a6" }}
                              title={vehicleLabel}
                            >
                              {vehicleLabel}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>

                    <div className="min-w-0">
                      <Badge
                        variant={paymentStatusVariant(booking.paymentStatus)}
                        className="px-[8px] py-[3px] text-[10px]"
                      >
                        {booking.paymentStatus}
                      </Badge>
                    </div>

                    <div className="hidden min-w-0 lg:block">
                      <Badge
                        variant={bookingStatusVariant(booking.status)}
                        className="px-[8px] py-[3px] text-[10px]"
                      >
                        {booking.status}
                      </Badge>
                    </div>

                    {isFullAdmin ? (
                      <div className="hidden lg:block">{rowActions(booking)}</div>
                    ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <AdminListPagination
            total={paged.total}
            page={paged.page}
            limit={paged.limit}
            shownCount={pageItems.length}
            onPageChange={setPage}
            onLimitChange={setLimit}
            pageSizeLabel="Per page"
          />
        </div>
      </div>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setEditError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit booking</DialogTitle>
            <DialogDescription>
              {editing
                ? `Update contact and collection details for ${editing.id}. Status, payment, and driver stay the same.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void saveEdit(event)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="edit-booking-name">Customer name</Label>
                <Input
                  id="edit-booking-name"
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="edit-booking-phone">Phone</Label>
                <Input
                  id="edit-booking-phone"
                  value={editForm.phone}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="edit-booking-email">Email</Label>
                <Input
                  id="edit-booking-email"
                  type="email"
                  value={editForm.email}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  required
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="edit-booking-street">Street</Label>
                <Input
                  id="edit-booking-street"
                  value={editForm.addressLine1}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      addressLine1: event.target.value,
                    }))
                  }
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="edit-booking-suburb">Suburb</Label>
                <Input
                  id="edit-booking-suburb"
                  value={editForm.suburb}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      suburb: event.target.value,
                    }))
                  }
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="edit-booking-city">City</Label>
                <Select
                  value={editForm.city}
                  onValueChange={(city) =>
                    setEditForm((current) => ({ ...current, city }))
                  }
                >
                  <SelectTrigger id="edit-booking-city" className="mt-1.5">
                    <SelectValue placeholder="City" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_CITIES.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-booking-date">Collection date</Label>
                <Input
                  id="edit-booking-date"
                  type="date"
                  value={editForm.collectionDate}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      collectionDate: event.target.value,
                    }))
                  }
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="edit-booking-slot">Collection slot</Label>
                <Select
                  value={editForm.collectionSlot}
                  onValueChange={(value) =>
                    setEditForm((current) => ({
                      ...current,
                      collectionSlot:
                        value === "AFTERNOON" ? "AFTERNOON" : "MORNING",
                    }))
                  }
                >
                  <SelectTrigger id="edit-booking-slot" className="mt-1.5">
                    <SelectValue placeholder="Slot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MORNING">Morning</SelectItem>
                    <SelectItem value="AFTERNOON">Afternoon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editError ? (
              <p className="text-sm text-[#b3261e]" role="alert">
                {editError}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete booking?</DialogTitle>
            <DialogDescription>
              {deleting
                ? `Remove ${deleting.id}? This only works for unpaid bookings that have not been collected and have no rug tag.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleting(null)}
              disabled={busyId === deleting?.id}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busyId === deleting?.id}
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPortalShell>
  );
}
