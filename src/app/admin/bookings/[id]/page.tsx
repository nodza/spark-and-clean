"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, User } from "lucide-react";
import { useBookingStore } from "@/store/useBookingStore";
import { BookingStatus, PaymentStatus, type InternalNote } from "@/types/booking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type DriverOption = { id: string; name: string; vehicle: string };

const STATUS_OPTIONS: BookingStatus[] = [
  "BOOKED",
  "SCHEDULED",
  "COLLECTED",
  "CLEANING",
  "DRYING",
  "READY",
  "DELIVERED",
];

const MAX_NOTE_LEN = 1000;

export default function AdminBookingDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const {
    bookings,
    fetchBookings,
    updateBookingStatus,
    updatePaymentStatus,
    assignDriver,
  } = useBookingStore();
  const booking = bookings.find((candidate) => candidate.id === id);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);

  const loadNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/bookings/${id}/notes`, {
        credentials: "include",
      });
      if (!res.ok) {
        setNotes([]);
        return;
      }
      const data = await res.json();
      const list: InternalNote[] = Array.isArray(data.notes) ? data.notes : [];
      list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setNotes(list);
    } catch {
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchBookings();
    void loadNotes();
    void fetch("/api/drivers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDrivers(data);
      })
      .catch(() => setDrivers([]));
  }, [fetchBookings, loadNotes]);

  const addNote = async () => {
    const body = noteDraft.trim();
    setNoteError(null);
    if (!body) {
      setNoteError("Note cannot be empty");
      return;
    }
    if (body.length > MAX_NOTE_LEN) {
      setNoteError(`Note must be at most ${MAX_NOTE_LEN} characters`);
      return;
    }

    setNoteSaving(true);
    try {
      const res = await fetch(`/api/bookings/${id}/notes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNoteError(
          typeof data.error === "string" ? data.error : "Failed to add note"
        );
        return;
      }
      const created = data.note as InternalNote | undefined;
      if (created) {
        setNotes((prev) => [created, ...prev]);
      } else {
        await loadNotes();
      }
      setNoteDraft("");
    } catch {
      setNoteError("Failed to add note");
    } finally {
      setNoteSaving(false);
    }
  };

  if (!booking) return <div className="p-10">Loading...</div>;

  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl">
      <Button variant="ghost" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Booking #{booking.id}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{booking.customer.name}</span>
            <span>•</span>
            <span>{booking.customer.phone}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">
            R{booking.estimatedPriceMin} - R{booking.estimatedPriceMax}
          </div>
          <p className="text-sm text-muted-foreground">Estimated Total</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Rug Type</Label>
                  <p className="font-medium">{booking.rug.type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Dimensions</Label>
                  <p className="font-medium">
                    {booking.rug.widthM}m x {booking.rug.lengthM}m (
                    {booking.rug.areaSqM}m²)
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Collection Date</Label>
                  <p className="font-medium">
                    {format(new Date(booking.collectionDate), "PPP")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Time Slot</Label>
                  <p className="font-medium">{booking.collectionSlot}</p>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-muted-foreground mb-2 block">Address</Label>
                <p className="font-medium">{booking.addressLine1}</p>
                <p className="text-muted-foreground">
                  {booking.suburb}, {booking.city}
                </p>
              </div>

              <Separator />

              <div>
                <Label className="text-muted-foreground mb-2 block">Add-ons</Label>
                <div className="flex gap-2">
                  {booking.addOns.odourRemoval && (
                    <span className="bg-secondary px-2 py-1 rounded text-sm">
                      Odour Removal & Hygiene Treatment
                    </span>
                  )}
                  {booking.addOns.stainProtection && (
                    <span className="bg-secondary px-2 py-1 rounded text-sm">
                      Stain Protection Treatment
                    </span>
                  )}
                  {!booking.addOns.odourRemoval &&
                    !booking.addOns.stainProtection && (
                      <span className="text-muted-foreground italic">None</span>
                    )}
                </div>
              </div>
            </CardContent>
          </Card>

          {booking.rug.photos && booking.rug.photos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Photos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {booking.rug.photos.map((photo, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={photo}
                      alt="Rug"
                      className="rounded-lg border"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Internal notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  value={noteDraft}
                  onChange={(e) => {
                    setNoteDraft(e.target.value);
                    if (noteError) setNoteError(null);
                  }}
                  placeholder="Gate code, dog on site, customer will EFT after collection…"
                  maxLength={MAX_NOTE_LEN}
                  rows={3}
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {noteDraft.trim().length}/{MAX_NOTE_LEN}
                    {noteError ? (
                      <span className="text-destructive ml-2">{noteError}</span>
                    ) : null}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={noteSaving}
                    onClick={() => void addNote()}
                  >
                    {noteSaving ? "Adding…" : "Add"}
                  </Button>
                </div>
              </div>

              <Separator />

              {notesLoading ? (
                <p className="text-sm text-muted-foreground">Loading notes…</p>
              ) : notes.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No internal notes yet.
                </p>
              ) : (
                <ul className="space-y-4">
                  {notes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-md border bg-muted/30 px-3 py-3"
                    >
                      <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {note.author}
                        {" · "}
                        {format(new Date(note.createdAt), "PPp")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status & Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Current Status</Label>
                <Select
                  value={booking.status}
                  onValueChange={(val) =>
                    updateBookingStatus(booking.id, val as BookingStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assign Driver</Label>
                <Select
                  value={booking.assignedDriverId || "unassigned"}
                  onValueChange={(val) => assignDriver(booking.id, val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned" disabled>
                      Select driver...
                    </SelectItem>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name} ({driver.vehicle})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={booking.paymentStatus}
                onValueChange={(val) =>
                  updatePaymentStatus(booking.id, val as PaymentStatus)
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="UNPAID" id="unpaid" />
                  <Label htmlFor="unpaid" className="text-destructive font-medium">
                    Unpaid
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="DEPOSIT" id="deposit" />
                  <Label htmlFor="deposit" className="text-orange-500 font-medium">
                    Deposit Paid
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PAID" id="paid" />
                  <Label htmlFor="paid" className="text-green-600 font-medium">
                    Paid in Full
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
