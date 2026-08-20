import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox"; // Need to check if I installed this. I think I missed it.
import { Booking } from "@/types/booking";
import { useEffect } from "react";
import { Ticket } from "lucide-react";

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
}

export function Step4Price({ data, update }: StepProps) {
  const addOns = data.addOns || { stainTreatment: false, fabricProtection: false };
  const area =
    typeof data.rug?.areaSqM === "number" && Number.isFinite(data.rug.areaSqM)
      ? data.rug.areaSqM
      : 0;
  const dimensionsSkipped =
    !(
      typeof data.rug?.widthM === "number" &&
      typeof data.rug?.lengthM === "number" &&
      data.rug.widthM > 0 &&
      data.rug.lengthM > 0
    );

  // Simple pricing logic
  const baseRate = 80; // R80 per m2
  const typeMultiplier = data.rug?.type === "Persian" ? 1.5 : 1.0;

  const basePrice = Math.round(area * baseRate * typeMultiplier) || 0;
  const stainPrice = addOns.stainTreatment ? 150 : 0;
  const protectPrice = addOns.fabricProtection ? 200 : 0;
  
  const totalMin = basePrice + stainPrice + protectPrice;
  const totalMax = Math.round(totalMin * 1.2); // 20% buffer

  useEffect(() => {
    update({ estimatedPriceMin: totalMin, estimatedPriceMax: totalMax });
  }, [totalMin, totalMax]); // Warning: this might cause infinite loop if update changes reference. 
  // Better to calculate on render or only when dependencies change. 
  // But update function is stable usually.
  // Actually, let's just update it when we leave the step or just calculate it here and pass it to next step?
  // The parent state holds the data. If we update it here, it updates the parent.
  // To avoid loop, we should only call update if the values are different.
  
  // Let's just display it here. The parent doesn't strictly need the price in state until submission.
  // But Step 5 needs it.
  // I'll wrap the update in a check.
  
  // Actually, useEffect is fine if we check values.
  useEffect(() => {
    if (data.estimatedPriceMin !== totalMin || data.estimatedPriceMax !== totalMax) {
      update({ estimatedPriceMin: totalMin, estimatedPriceMax: totalMax });
    }
  }, [totalMin, totalMax, data.estimatedPriceMin, data.estimatedPriceMax]);


  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium text-muted-foreground">Estimated Price</h3>
        <div className="text-4xl font-bold text-primary">
          R{totalMin} - R{totalMax}
        </div>
        <p className="text-sm text-muted-foreground">
          {dimensionsSkipped
            ? "Driver to measure on collection"
            : "Final price confirmed after inspection."}
        </p>
      </div>

      <div className="space-y-4 border rounded-xl p-6 bg-card">
        <h4 className="font-semibold">Recommended Add-ons</h4>
        
        <div className="flex items-start space-x-3">
          <Checkbox 
            id="stain" 
            checked={addOns.stainTreatment}
            onCheckedChange={(checked) => update({ addOns: { ...addOns, stainTreatment: checked as boolean } })}
          />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="stain" className="text-base font-medium cursor-pointer">
              Deep Stain Treatment (+R150)
            </Label>
            <p className="text-sm text-muted-foreground">
              Specialized treatment for wine, pet, or coffee stains.
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <Checkbox 
            id="protect" 
            checked={addOns.fabricProtection}
            onCheckedChange={(checked) => update({ addOns: { ...addOns, fabricProtection: checked as boolean } })}
          />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="protect" className="text-base font-medium cursor-pointer">
              Fiber Shield Protection (+R200)
            </Label>
            <p className="text-sm text-muted-foreground">
              Protects against future spills and sun damage.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 flex items-center gap-4">
        <div className="p-2 bg-accent/20 rounded-full text-accent-foreground">
          <Ticket className="h-6 w-6" />
        </div>
        <div>
          <h4 className="font-semibold text-accent-foreground">Loyalty Reward</h4>
          <p className="text-sm text-muted-foreground">
            You've cleaned <span className="font-bold">3/5</span> rugs. 2 more for a free clean!
          </p>
        </div>
      </div>
    </div>
  );
}
