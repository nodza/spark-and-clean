"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { loginUser } from "@/lib/authClient";
import { useAuth } from "@/components/auth/AuthProvider";

function redirectForRole(role: string, next?: string | null) {
  if (next && next.startsWith("/")) return next;
  if (role === "ADMIN") return "/admin";
  if (role === "DRIVER") return "/tech/dashboard";
  return "/dashboard";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { user, ready, refresh } = useAuth();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) {
      router.replace(redirectForRole(user.role, next));
    }
  }, [ready, user, router, next]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await loginUser({ email, password });
    setLoading(false);
    if (result.error || !result.user) {
      setError(result.error || "Login failed");
      return;
    }
    await refresh();
    router.push(redirectForRole(result.user.role, next));
  };

  return (
    <div className="container flex items-center justify-center min-h-[80vh] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            Sign in with your Spark &amp; Clean account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
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
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
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
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <div className="text-center text-sm text-muted-foreground mt-4 space-y-1">
              <p>
                Demo customer: <strong>sarah.j@example.com</strong>
              </p>
              <p>
                Demo admin: <strong>admin@sparkandclean.co.za</strong>
              </p>
              <p>
                Password: <strong>Password123!</strong>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ClientLogin() {
  return (
    <Suspense
      fallback={
        <div className="container py-20 text-center">Loading…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
