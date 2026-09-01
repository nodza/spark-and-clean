"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";

export function Header() {
  const router = useRouter();
  const { user, ready, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const isCustomer = user?.role === "CUSTOMER";
  const isAdmin = user?.role === "ADMIN";
  const isDriver = user?.role === "DRIVER";

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://www.sparkandclean.co.za/wp-content/uploads/2017/10/spark-and-clean-22.png"
            alt="Spark & Clean"
            className="h-10 w-auto"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link href="/" className="hover:text-primary transition-colors">
            Home
          </Link>
          <Link
            href="/services/automatic-rug-cleaning"
            className="hover:text-primary transition-colors"
          >
            Services
          </Link>
          <Link href="/contact" className="hover:text-primary transition-colors">
            Contact
          </Link>
          {ready && isCustomer ? (
            <Link
              href="/dashboard"
              className="hover:text-primary transition-colors text-foreground font-semibold"
            >
              My Bookings
            </Link>
          ) : ready && !user ? (
            <Link
              href="/login"
              className="hover:text-primary transition-colors"
            >
              View My Booking
            </Link>
          ) : null}
          {isAdmin && (
            <Link
              href="/admin"
              className="hover:text-primary transition-colors text-foreground font-semibold"
            >
              Admin
            </Link>
          )}
          {isDriver && (
            <Link
              href="/tech/dashboard"
              className="hover:text-primary transition-colors text-foreground font-semibold"
            >
              Technician
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          {ready && user ? (
            <>
              {isCustomer && (
                <Link
                  href="/dashboard"
                  className="md:hidden text-sm font-semibold text-foreground hover:text-primary"
                >
                  My Bookings
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleLogout()}
              >
                Log out
              </Button>
            </>
          ) : ready ? (
            <Link
              href="/login"
              className="md:hidden text-sm font-medium text-muted-foreground hover:text-primary"
            >
              View My Booking
            </Link>
          ) : null}
          <Link href="/book/rug">
            <Button>Book a Collection</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
