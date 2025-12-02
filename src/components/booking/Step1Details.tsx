import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Booking } from "@/types/booking";

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
}

export function Step1Details({ data, update }: StepProps) {
  const rug = data.rug || { type: "", widthM: 0, lengthM: 0, areaSqM: 0 };

  const handleDimensionChange = (field: "widthM" | "lengthM", value: string) => {
    const numValue = parseFloat(value) || 0;
    const newRug = { ...rug, [field]: numValue };
    newRug.areaSqM = Number((newRug.widthM * newRug.lengthM).toFixed(2));
    update({ rug: newRug });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="rug-type">Rug Type</Label>
        <Select 
          value={rug.type} 
          onValueChange={(val) => update({ rug: { ...rug, type: val } })}
        >
          <SelectTrigger id="rug-type">
            <SelectValue placeholder="Select rug type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Persian">Persian / Oriental</SelectItem>
            <SelectItem value="Kilim">Kilim / Dhurrie</SelectItem>
            <SelectItem value="Shaggy">Shaggy / High Pile</SelectItem>
            <SelectItem value="Machine">Machine Made / Synthetic</SelectItem>
            <SelectItem value="Wool">Wool / Berber</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="width">Width (meters)</Label>
          <Input 
            id="width" 
            type="number" 
            step="0.1" 
            placeholder="e.g. 2.5"
            value={rug.widthM || ""}
            onChange={(e) => handleDimensionChange("widthM", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="length">Length (meters)</Label>
          <Input 
            id="length" 
            type="number" 
            step="0.1" 
            placeholder="e.g. 3.0"
            value={rug.lengthM || ""}
            onChange={(e) => handleDimensionChange("lengthM", e.target.value)}
          />
        </div>
      </div>

      <div className="p-4 bg-secondary/20 rounded-lg flex justify-between items-center">
        <span className="font-medium">Total Area:</span>
        <span className="text-2xl font-bold text-primary">{rug.areaSqM} m²</span>
      </div>
    </div>
  );
}
