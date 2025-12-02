import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Booking } from "@/types/booking";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
}

export function Step3Location({ data, update }: StepProps) {
  const customer = data.customer || { id: "", name: "", email: "", phone: "" };
  
  // Mock availability: Kraaifontein (Mon, Thu), Durbanville (Tue, Fri)
  // For prototype, we just allow any date for now to avoid complex logic blocking the demo.

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Collection Address</h3>
        <div className="space-y-2">
          <Label htmlFor="address">Street Address</Label>
          <Input 
            id="address" 
            placeholder="e.g. 42 Protea Way"
            value={data.addressLine1 || ""}
            onChange={(e) => update({ addressLine1: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="suburb">Suburb</Label>
            <Select 
              value={data.suburb} 
              onValueChange={(val) => update({ suburb: val })}
            >
              <SelectTrigger id="suburb">
                <SelectValue placeholder="Select suburb" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Durbanville">Durbanville</SelectItem>
                <SelectItem value="Kraaifontein">Kraaifontein</SelectItem>
                <SelectItem value="Sea Point">Sea Point</SelectItem>
                <SelectItem value="City Bowl">City Bowl</SelectItem>
                <SelectItem value="Claremont">Claremont</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input 
              id="city" 
              value={data.city || "Cape Town"} 
              onChange={(e) => update({ city: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Preferred Collection Time</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !data.collectionDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {data.collectionDate ? format(new Date(data.collectionDate), "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={data.collectionDate ? new Date(data.collectionDate) : undefined}
                  onSelect={(date) => update({ collectionDate: date?.toISOString() })}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot">Time Slot</Label>
            <Select 
              value={data.collectionSlot} 
              onValueChange={(val: any) => update({ collectionSlot: val })}
            >
              <SelectTrigger id="slot">
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MORNING">Morning (08:00 - 12:00)</SelectItem>
                <SelectItem value="AFTERNOON">Afternoon (12:00 - 16:00)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Contact Details</h3>
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input 
            id="name" 
            placeholder="John Doe"
            value={customer.name}
            onChange={(e) => update({ customer: { ...customer, name: e.target.value } })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input 
              id="phone" 
              placeholder="082 123 4567"
              value={customer.phone}
              onChange={(e) => update({ customer: { ...customer, phone: e.target.value } })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="john@example.com"
              value={customer.email}
              onChange={(e) => update({ customer: { ...customer, email: e.target.value } })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
