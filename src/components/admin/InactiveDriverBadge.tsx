import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Warning chip for bookings still assigned to an inactive driver. */
export function InactiveDriverBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="status-overdue"
      className={cn("gap-1", className)}
      title="This driver is inactive"
    >
      <AlertTriangle className="size-3" strokeWidth={2.4} aria-hidden />
      Inactive
    </Badge>
  );
}
