interface Driver {
  id: string;
  name: string;
  phone: string;
  email?: string;
  vehicle: string;
  isActive: boolean;
  city?: string;
  notes?: string;
}

class DriverService {
  async getDrivers(): Promise<Driver[]> {
    const res = await fetch("/api/drivers", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch drivers");
    return res.json();
  }

  async getDriverById(id: string): Promise<Driver | undefined> {
    const res = await fetch(`/api/drivers/${id}`, { credentials: "include" });
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error("Failed to fetch driver");
    return res.json();
  }

  async updateDriver(id: string, updates: Partial<Driver>): Promise<Driver> {
    const res = await fetch(`/api/drivers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update driver");
    return res.json();
  }

  async updateIsActive(id: string, isActive: boolean): Promise<Driver> {
    return this.updateDriver(id, { isActive });
  }
}

export const driverService = new DriverService();
