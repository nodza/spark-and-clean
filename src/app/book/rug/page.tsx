"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Step1Details } from "@/components/booking/Step1Details";
import { Step2Photos } from "@/components/booking/Step2Photos";
import { Step3Location } from "@/components/booking/Step3Location";
import { Step4Price } from "@/components/booking/Step4Price";
import { Step5Review } from "@/components/booking/Step5Review";
import { BookingSuccessPanel } from "@/components/booking/BookingSuccessPanel";
import { generateBookingReference } from "@/lib/bookingReference";
import { useBookingStore } from "@/store/useBookingStore";
import { Booking } from "@/types/booking";

function buildSubmittedBooking(
  formData: Partial<Booking>,
  bookingId: string
): Booking {
  const customer = formData.customer || {
    id: "",
    name: "",
    email: "",
    phone: "",
  };

  return {
    id: bookingId,
    customer: {
      ...customer,
      id: customer.id || `guest-${Date.now()}`,
    },
    suburb: formData.suburb || "",
    addressLine1: formData.addressLine1 || "",
    city: formData.city || "",
    coordinates: formData.coordinates,
    collectionDate: formData.collectionDate || new Date().toISOString(),
    collectionSlot: formData.collectionSlot || "MORNING",
    rug: formData.rug || {
      type: "",
      widthM: null,
      lengthM: null,
      areaSqM: 0,
      photos: [],
    },
    addOns: formData.addOns || {
      stainTreatment: false,
      fabricProtection: false,
    },
    estimatedPriceMin: formData.estimatedPriceMin || 0,
    estimatedPriceMax: formData.estimatedPriceMax || 0,
    couponCode: formData.couponCode,
    status: "BOOKED",
    paymentStatus: "UNPAID",
    createdAt: new Date().toISOString(),
  };
}

export default function BookingWizard() {
  const addBooking = useBookingStore((s) => s.addBooking);
  const [step, setStep] = useState(1);
  const [submittedBookingId, setSubmittedBookingId] = useState<string | null>(null);
  const [showTypeError, setShowTypeError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<Booking>>({
    rug: { type: "", widthM: null, lengthM: null, areaSqM: 0, photos: [] },
    addOns: { stainTreatment: false, fabricProtection: false },
    customer: { id: "", name: "", email: "", phone: "" },
  });

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const nextStep = () => {
    if (step === 1 && !formData.rug?.type) {
      setShowTypeError(true);
      return;
    }
    setStep((s) => Math.min(s + 1, totalSteps));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const updateFormData = (data: Partial<Booking>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const confirmBooking = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const bookingId = generateBookingReference(formData.city);
    const booking = buildSubmittedBooking(formData, bookingId);

    console.log("Submitting booking payload:", booking);

    try {
      sessionStorage.setItem(`booking:${bookingId}`, JSON.stringify(booking));
    } catch {
      // ignore private-mode storage failures
    }

    const created = await addBooking(booking);
    const resolvedId = created?.id || bookingId;

    if (created) {
      try {
        sessionStorage.setItem(`booking:${resolvedId}`, JSON.stringify(created));
      } catch {
        // ignore
      }
    } else {
      useBookingStore.setState((state) => ({
        bookings: [
          ...state.bookings.filter((b) => b.id !== bookingId),
          booking,
        ],
      }));
    }

    setSubmittedBookingId(resolvedId);
    setIsSubmitting(false);
  };

  if (submittedBookingId) {
    return (
      <BookingSuccessPanel
        bookingId={submittedBookingId}
        email={formData.customer?.email || ""}
      />
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <div className="mb-2 flex justify-between text-sm font-medium text-muted-foreground">
          <span>
            Step {step} of {totalSteps}
          </span>
          <span>{Math.round(progress)}% Completed</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-300 ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === 1 && "Rug Details"}
            {step === 2 && "Upload Photos"}
            {step === 3 && "Collection Details"}
            {step === 4 && "Estimated Price"}
            {step === 5 && "Review & Confirm"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <Step1Details
              data={formData}
              update={updateFormData}
              showTypeError={showTypeError}
              onTypeSelected={() => setShowTypeError(false)}
            />
          )}
          {step === 2 && <Step2Photos data={formData} update={updateFormData} />}
          {step === 3 && <Step3Location data={formData} update={updateFormData} />}
          {step === 4 && <Step4Price data={formData} update={updateFormData} />}
          {step === 5 && <Step5Review data={formData} update={updateFormData} />}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={prevStep} disabled={step === 1}>
            Back
          </Button>
          {step < totalSteps ? (
            <Button onClick={nextStep}>Next</Button>
          ) : (
            <Button onClick={confirmBooking} disabled={isSubmitting}>
              {isSubmitting ? "Confirming..." : "Confirm Booking"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
