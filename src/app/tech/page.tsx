"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import driversData from "@/data/drivers.json";
import { Truck } from "lucide-react";

export default function TechLogin() {
  const router = useRouter();

  const handleLogin = (driverId: string) => {
    // In a real app, we'd set a cookie or session.
    // For prototype, we just pass the ID via query param or just assume "logged in" context.
    // Let's store it in localStorage for simplicity if we wanted, but query param is easier for demo.
    // Actually, let's just route to dashboard and maybe use a context later if needed.
    // For now, we'll just simulate "I am this driver".
    localStorage.setItem("currentDriverId", driverId);
    router.push("/tech/dashboard");
  };

  return (
    <div className="container max-w-md mx-auto py-20 px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Truck className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Driver Login</h1>
        <p className="text-muted-foreground">Select your profile to continue.</p>
      </div>

      <div className="grid gap-4">
        {driversData.map((driver) => (
          <Card 
            key={driver.id} 
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => handleLogin(driver.id)}
          >
            <CardHeader className="flex flex-row items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-bold text-secondary-foreground">
                {driver.name.charAt(0)}
              </div>
              <div>
                <CardTitle className="text-base">{driver.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{driver.vehicle}</p>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
