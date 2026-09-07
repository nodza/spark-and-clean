  "use client";

  import { useEffect, useState } from "react";
  import { useRouter } from "next/navigation";
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { PasswordInput } from "@/components/ui/password-input";
  import { Label } from "@/components/ui/label";
  import { Truck } from "lucide-react";
  import { loginUser } from "@/lib/authClient";
  import { useAuth } from "@/components/auth/AuthProvider";

  export default function TechLogin() {
    const router = useRouter();
    const { user, ready, refresh } = useAuth();
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (ready && user?.role === "technician") {
        router.replace("/tech/dashboard");
      }
    }, [ready, user, router]);

    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      const result = await loginUser({
        email,
        password,
        role: "technician",
      });
      setLoading(false);
      if (result.error || !result.user) {
        setError(result.error || "Login failed");
        return;
      }
      await refresh();
      router.push("/tech/dashboard");
    };

    return (
      <div className="container max-w-md mx-auto py-20 px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Driver Login</h1>
          <p className="text-muted-foreground">
            Sign in with your driver account
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staff credentials</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="driver-email">Email</Label>
                <Input
                  id="driver-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-password">Password</Label>
                <PasswordInput
                  id="driver-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Continue to jobs"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Demo: thabo.driver@sparkandclean.co.za / Password123!
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }
