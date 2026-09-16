import { toClientUser } from "@/lib/serialize";

export function toTechnicianRow(
  userDoc: Record<string, unknown>,
  driver?: Record<string, unknown> | null
) {
  const user = toClientUser(userDoc);
  return {
    ...user,
    vehicle: (typeof driver?.vehicle === "string" ? driver.vehicle : null) ?? null,
    driverIsActive:
      !driver ? null : driver.isActive !== false && !user.disabledAt,
  };
}
