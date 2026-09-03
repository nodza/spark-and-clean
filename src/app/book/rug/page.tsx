"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Step1Details } from "@/components/booking/Step1Details";
import { Step2Photos } from "@/components/booking/Step2Photos";
import { Step3Location } from "@/components/booking/Step3Location";
import { Step4Price } from "@/components/booking/Step4Price";
import { Step5Review } from "@/components/booking/Step5Review";
import { BookingSuccessPanel } from "@/components/booking/BookingSuccessPanel";
import { generateBookingReference } from "@/lib/bookingReference";
import { useAuth } from "@/components/auth/AuthProvider";
import { useBookingStore } from "@/store/useBookingStore";
import { Booking, Customer } from "@/types/booking";
import { isPersistedClient } from "@/types/user";

function isValidContact(customer?: Customer) {
  if (!customer) return false;
  const name = customer.name.trim();
  const phone = customer.phone.trim();
  const email = customer.email.trim().toLowerCase();
  return name.length > 1 && phone.length >= 7 && email.includes("@") && email.includes(".");
}

function latestBookingForEmail(bookings: Booking[], email: string): Booking | undefined {
  const needle = email.toLowerCase();
  return bookings
    .filter((b) => b.customer.email.toLowerCase() === needle)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
}

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
      odourRemoval: false,
      stainProtection: false,
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
  const router = useRouter();
  const { user, ready } = useAuth();
  const sessionEmail = isPersistedClient(user) ? user!.email.trim() : null;
  const isLoggedInCustomer = Boolean(sessionEmail);

  const addBooking = useBookingStore((s) => s.addBooking);
  const fetchBookings = useBookingStore((s) => s.fetchBookings);
  const bookings = useBookingStore((s) => s.bookings);

  const [step, setStep] = useState(1);
  const [submittedBookingId, setSubmittedBookingId] = useState<string | null>(null);
  const [showTypeError, setShowTypeError] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [contactError, setContactError] = useState(false);
  const [formData, setFormData] = useState<Partial<Booking>>({
    rug: { type: "", widthM: null, lengthM: null, areaSqM: 0, photos: [] },
    addOns: {
      odourRemoval: false,
      stainProtection: false,
    },
    customer: { id: "", name: "", email: "", phone: "" },
  });

  useEffect(() => {
    if (!ready || !sessionEmail) return;
    void fetchBookings({ silent: true });
  }, [ready, sessionEmail, fetchBookings]);

  useEffect(() => {
    if (!ready || !sessionEmail) return;

    const prior = latestBookingForEmail(bookings, sessionEmail);
    const sessionName = user?.name?.trim() || "";
    const sessionPhone = user?.phone?.trim() || "";

    setFormData((prev) => {
      const customer: Customer = prev.customer || {
        id: "",
        name: "",
        email: "",
        phone: "",
      };

      const looksAutoName =
        !customer.name || customer.name === sessionName;
      const looksAutoPhone =
        !customer.phone || customer.phone === sessionPhone;

      const next: Customer = {
        id: customer.id || prior?.customer.id || user?.id || "",
        email: sessionEmail,
        name: looksAutoName
          ? prior?.customer.name || sessionName
          : customer.name,
        phone: looksAutoPhone
          ? prior?.customer.phone || sessionPhone
          : customer.phone,
      };

      if (
        next.email === customer.email &&
        next.name === customer.name &&
        next.phone === customer.phone &&
        next.id === customer.id
      ) {
        return prev;
      }

      return { ...prev, customer: next };
    });
  }, [ready, sessionEmail, bookings, user]);

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const nextStep = () => {
    if (step === 1 && !formData.rug?.type) {
      setShowTypeError(true);
      return;
    }
    if (step === 3 && !isValidContact(formData.customer)) {
      setContactError(true);
      return;
    }
    setContactError(false);
    setStep((s) => Math.min(s + 1, totalSteps));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const updateFormData = (data: Partial<Booking>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const confirmBooking = async () => {
    if (!termsAccepted || isSubmitting) return;
    const contact: Customer = {
      id: formData.customer?.id || user?.id || "",
      name: formData.customer?.name || "",
      phone: formData.customer?.phone || "",
      email: sessionEmail || formData.customer?.email || "",
    };
    if (!isValidContact(contact)) {
      setContactError(true);
      setSubmitError(
        "Add your name, email, and phone in Collection Details before confirming."
      );
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);

    const bookingId = generateBookingReference(formData.city);
    const booking = buildSubmittedBooking(
      {
        ...formData,
        customer: contact,
      },
      bookingId
    );

    const created = await addBooking(booking);
    if (!created) {
      setSubmitError("Could not save your booking. Please try again.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);

    if (isLoggedInCustomer) {
      router.push(`/booking/${created.id}`);
      return;
    }

    setSubmittedBookingId(created.id);
  };

  if (submittedBookingId) {
    return (
      <BookingSuccessPanel
        bookingId={submittedBookingId}
        email={formData.customer?.email || ""}
        name={formData.customer?.name || ""}
        phone={formData.customer?.phone || ""}
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
          {step === 3 && (
            <Step3Location
              data={formData}
              update={updateFormData}
              emailReadOnly={isLoggedInCustomer}
              contactError={contactError}
              onContactEdit={() => setContactError(false)}
            />
          )}
          {step === 4 && <Step4Price data={formData} update={updateFormData} />}
          {step === 5 && (
            <Step5Review
              data={formData}
              termsAccepted={termsAccepted}
              onTermsAcceptedChange={setTermsAccepted}
            />
          )}
          {submitError && (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {submitError}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={prevStep} disabled={step === 1}>
            Back
          </Button>
          {step < totalSteps ? (
            <Button onClick={nextStep}>Next</Button>
          ) : (
            <Button onClick={confirmBooking} disabled={!termsAccepted || isSubmitting}>
              {isSubmitting ? "Confirming..." : "Confirm Booking"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
