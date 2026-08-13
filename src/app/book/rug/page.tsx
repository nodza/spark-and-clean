"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress"; // Need to install this? I'll check.
import { Step1Details } from "@/components/booking/Step1Details";
import { Step2Photos } from "@/components/booking/Step2Photos";
import { Step3Location } from "@/components/booking/Step3Location";
import { Step4Price } from "@/components/booking/Step4Price";
import { Step5Review } from "@/components/booking/Step5Review";
import { useBookingStore } from "@/store/useBookingStore";
import { Booking } from "@/types/booking";

export default function BookingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<Booking>>({
    rug: { type: "", widthM: 0, lengthM: 0, areaSqM: 0, photos: [] },
    addOns: { stainTreatment: false, fabricProtection: false },
    customer: { id: "", name: "", email: "", phone: "" }, // Will fill in review or separate step? PRD didn't specify auth, so maybe just input in review or location.
    // Let's assume customer details are part of Step 3 (Location) or Step 5 (Review) for a guest checkout flow.
    // PRD Step 3 is "Location & Collection Slot".
    // PRD Step 5 is "Review & Confirm".
    // I'll add customer fields to Step 3 or 5. Let's put them in Step 3 with address.
  });

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const nextStep = () => setStep((s) => Math.min(s + 1, totalSteps));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const updateFormData = (data: Partial<Booking>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  return (
    <div className="container max-w-2xl mx-auto py-10 px-4">
      <div className="mb-8">
        <div className="flex justify-between text-sm font-medium text-muted-foreground mb-2">
          <span>Step {step} of {totalSteps}</span>
          <span>{Math.round(progress)}% Completed</span>
        </div>
        {/* Simple progress bar using Tailwind since I might not have the component installed yet */}
        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
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
          {step === 1 && <Step1Details data={formData} update={updateFormData} />}
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
            <Button
              onClick={() => {
                const payload = {
                  ...formData,
                  addressLine1: formData.addressLine1,
                  suburb: formData.suburb,
                  city: formData.city,
                  coordinates: formData.coordinates,
                };
                // Phase 1 mock payload — includes captured lat/lng for E11/E16
                console.log("Submitting booking payload:", payload);
                router.push("/booking/SC-2025-MOCK");
              }}
            >
              Confirm Booking
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
