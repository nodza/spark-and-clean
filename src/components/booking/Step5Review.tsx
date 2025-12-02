import { Booking } from "@/types/booking";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Need to install this?
import { format } from "date-fns";

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
}

export function Step5Review({ data, update }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground block">Rug Type</span>
            <span className="font-medium">{data.rug?.type} ({data.rug?.widthM}m x {data.rug?.lengthM}m)</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Collection</span>
            <span className="font-medium">
              {data.collectionDate ? format(new Date(data.collectionDate), "PPP") : "-"} <br/>
              {data.collectionSlot === "MORNING" ? "08:00 - 12:00" : "12:00 - 16:00"}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground block">Address</span>
            <span className="font-medium">{data.addressLine1}, {data.suburb}, {data.city}</span>
          </div>
          <div className="col-span-2">
             <span className="text-muted-foreground block">Add-ons</span>
             <span className="font-medium">
               {[
                 data.addOns?.stainTreatment && "Stain Treatment",
                 data.addOns?.fabricProtection && "Fiber Shield"
               ].filter(Boolean).join(", ") || "None"}
             </span>
          </div>
        </div>
        
        <div className="border-t pt-4 flex justify-between items-center">
          <span className="font-semibold">Estimated Total</span>
          <span className="text-xl font-bold text-primary">
            R{data.estimatedPriceMin} - R{data.estimatedPriceMax}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">Payment Method</h3>
        <RadioGroup defaultValue="eft" onValueChange={(val) => console.log(val)}>
          <div className="flex items-center space-x-2 border p-4 rounded-lg cursor-pointer hover:bg-secondary/10">
            <RadioGroupItem value="eft" id="eft" />
            <Label htmlFor="eft" className="flex-1 cursor-pointer">EFT / Bank Transfer (Invoice sent via email)</Label>
          </div>
          <div className="flex items-center space-x-2 border p-4 rounded-lg cursor-pointer hover:bg-secondary/10">
            <RadioGroupItem value="card" id="card" />
            <Label htmlFor="card" className="flex-1 cursor-pointer">Card on Delivery (Yoco/Tap)</Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
