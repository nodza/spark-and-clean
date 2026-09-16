"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Step1Details } from "@/components/booking/Step1Details";
import { Step2Photos } from "@/components/booking/Step2Photos";
import { Step3Location } from "@/components/booking/Step3Location";
import { Step4Price } from "@/components/booking/Step4Price";
import { Step5Review } from "@/components/booking/Step5Review";
import { BookingSuccessPanel } from "@/components/booking/BookingSuccessPanel";
import {
  BookingWizardShell,
  CLIENT_STEP_TITLES,
} from "@/components/booking/BookingWizardShell";
import { generateBookingReference } from "@/lib/bookingReference";
import { estimateBookingPrice } from "@/lib/bookingEstimate";
import {
  hasFieldErrors,
  validateStep1Dimensions,
  validateStep3Contact,
  type FieldErrors,
} from "@/lib/bookingValidation";
import { getRugTypeLabel } from "@/data/rugTypes";
import { useAuth } from "@/components/auth/AuthProvider";
import { useBookingStore } from "@/store/useBookingStore";
import { Booking, Customer } from "@/types/booking";
import { isPersistedClient } from "@/types/user";

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
  // Guests / leftover guest JWTs must not count as logged-in customers
  const sessionEmail = isPersistedClient(user) ? user!.email.trim() : null;
  const isLoggedInCustomer = Boolean(sessionEmail);

  const addBooking = useBookingStore((s) => s.addBooking);
  const fetchBookings = useBookingStore((s) => s.fetchBookings);
  const bookings = useBookingStore((s) => s.bookings);

  const [step, setStep] = useState(1);
  const [submittedBookingId, setSubmittedBookingId] = useState<string | null>(null);
  const [showTypeError, setShowTypeError] = useState(false);
  const [step1Errors, setStep1Errors] = useState<FieldErrors>({});
  const [step3Errors, setStep3Errors] = useState<FieldErrors>({});
  const [sizeSkipped, setSizeSkipped] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
  const estimate = useMemo(
    () => estimateBookingPrice(formData),
    [formData.rug, formData.addOns]
  );

  useEffect(() => {
    if (
      formData.estimatedPriceMin === estimate.totalMin &&
      formData.estimatedPriceMax === estimate.totalMax
    ) {
      return;
    }
    setFormData((prev) => ({
      ...prev,
      estimatedPriceMin: estimate.totalMin,
      estimatedPriceMax: estimate.totalMax,
    }));
  }, [
    estimate.totalMin,
    estimate.totalMax,
    formData.estimatedPriceMin,
    formData.estimatedPriceMax,
  ]);

  const nextStep = () => {
    if (step === 1) {
      if (!formData.rug?.type) {
        setShowTypeError(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const dimErrors = validateStep1Dimensions(formData.rug);
      setStep1Errors(dimErrors);
      if (hasFieldErrors(dimErrors)) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    if (step === 3) {
      const contactErrors = validateStep3Contact(formData);
      setStep3Errors(contactErrors);
      if (hasFieldErrors(contactErrors)) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    setStep((s) => Math.min(s + 1, totalSteps));
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const prevStep = () => {
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const clearStep1Error = (field: string) =>
    setStep1Errors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const clearStep3Error = (field: string) =>
    setStep3Errors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const updateFormData = (data: Partial<Booking>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const confirmBooking = async () => {
    if (!termsAccepted || isSubmitting) return;

    const contactErrors = validateStep3Contact({
      ...formData,
      customer: {
        name: formData.customer?.name || "",
        phone: formData.customer?.phone || "",
        email: sessionEmail || formData.customer?.email || "",
      },
    });
    const dimErrors = validateStep1Dimensions(formData.rug);
    if (hasFieldErrors(contactErrors) || hasFieldErrors(dimErrors)) {
      setStep3Errors(contactErrors);
      setStep1Errors(dimErrors);
      if (hasFieldErrors(dimErrors)) setStep(1);
      else if (hasFieldErrors(contactErrors)) setStep(3);
      setSubmitError("Please fix the highlighted fields before confirming.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const contact: Customer = {
      id: formData.customer?.id || user?.id || "",
      name: formData.customer?.name || "",
      phone: formData.customer?.phone || "",
      email: sessionEmail || formData.customer?.email || "",
    };

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

  const addOnCount = [
    formData.addOns?.odourRemoval,
    formData.addOns?.stainProtection,
  ].filter(Boolean).length;

  const estimatePrimary =
    estimate.dimensionsSkipped || estimate.totalMin <= 0
      ? "TBC"
      : `R${estimate.totalMin}`;
  const estimateHint =
    estimate.dimensionsSkipped || estimate.totalMin <= 0
      ? "Measured on pickup"
      : estimate.totalMax > estimate.totalMin
        ? `up to R${estimate.totalMax}`
        : undefined;

  const isLastStep = step === totalSteps;
  const continueDisabled = isLastStep && (!termsAccepted || isSubmitting);

  return (
    <BookingWizardShell
      step={step}
      totalSteps={totalSteps}
      title={CLIENT_STEP_TITLES[step - 1]}
      summary={{
        rugLabel: getRugTypeLabel(formData.rug?.type),
        cityLabel: formData.city?.trim() || "—",
        addOnsLabel: addOnCount ? `${addOnCount} selected` : "none",
        estimatePrimary,
        estimateHint,
      }}
      showBack={step > 1}
      onBack={prevStep}
      onContinue={isLastStep ? confirmBooking : nextStep}
      continueLabel={
        isLastStep ? (
          isSubmitting ? (
            "Confirming..."
          ) : (
            <>
              <span className="sm:hidden">Confirm →</span>
              <span className="hidden sm:inline">Confirm booking →</span>
            </>
          )
        ) : (
          "Continue →"
        )
      }
      continueDisabled={continueDisabled}
      continueHint={
        isLastStep && !termsAccepted
          ? "Accept the terms below to confirm your booking."
          : isSubmitting
            ? "Saving your booking."
            : undefined
      }
    >
      {step === 1 && (
        <Step1Details
          data={formData}
          update={updateFormData}
          showTypeError={showTypeError}
          onTypeSelected={() => setShowTypeError(false)}
          errors={step1Errors}
          onClearError={clearStep1Error}
          sizeSkipped={sizeSkipped}
          onSizeSkippedChange={setSizeSkipped}
        />
      )}
      {step === 2 && <Step2Photos data={formData} update={updateFormData} />}
      {step === 3 && (
        <Step3Location
          data={formData}
          update={updateFormData}
          emailReadOnly={isLoggedInCustomer}
          errors={step3Errors}
          onClearError={clearStep3Error}
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
    </BookingWizardShell>
  );
}
