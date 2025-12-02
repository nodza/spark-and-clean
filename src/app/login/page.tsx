"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";

export default function ClientLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("sarah.j@example.com"); // Pre-fill for demo

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // In real app: Auth check.
    // Demo: Just store email to filter bookings.
    localStorage.setItem("clientEmail", email);
    router.push("/dashboard");
  };

  return (
    <div className="container flex items-center justify-center min-h-[80vh] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Enter your email to view your bookings</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="name@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              View My Bookings
            </Button>
            <div className="text-center text-sm text-muted-foreground mt-4">
              <p>Demo Hint: Use <strong>sarah.j@example.com</strong></p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
