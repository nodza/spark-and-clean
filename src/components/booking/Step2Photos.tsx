import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Booking } from "@/types/booking";
import { Upload, X, Image as ImageIcon } from "lucide-react";

interface StepProps {
  data: Partial<Booking>;
  update: (data: Partial<Booking>) => void;
}

export function Step2Photos({ data, update }: StepProps) {
  const photos = data.rug?.photos || [];

  const addMockPhoto = () => {
    // In a real app, this would trigger a file input.
    // For prototype, we just add a placeholder URL.
    const newPhoto = `https://placehold.co/400x300/e2e8f0/1e293b?text=Rug+Photo+${photos.length + 1}`;
    update({ 
      rug: { 
        ...data.rug!, 
        photos: [...photos, newPhoto] 
      } 
    });
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    update({ 
      rug: { 
        ...data.rug!, 
        photos: newPhotos 
      } 
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center p-8 border-2 border-dashed rounded-xl border-muted-foreground/25 hover:border-primary/50 transition-colors">
        <div className="flex flex-col items-center gap-2">
          <div className="p-4 bg-secondary rounded-full">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">Upload Photos</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">
            Help us assess your rug's condition. Photos are optional but recommended.
          </p>
          <Button onClick={addMockPhoto} variant="outline">
            Select Photos
          </Button>
        </div>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {photos.map((photo, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden border">
              <img src={photo} alt={`Rug ${i + 1}`} className="w-full h-32 object-cover" />
              <button 
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
