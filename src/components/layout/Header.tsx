"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  MARKETING_BOOK_CTA,
  getMarketingDesktopNavItems,
  getMarketingMobileMenuItems,
  isMarketingNavAction,
  type MarketingNavItem,
} from "@/config/nav";
import { isFullAccount } from "@/types/user";
import { cn } from "@/lib/utils";

/**
 * Marketing site header (SCW-34).
 * Never advertises /admin or /tech.
 * Desktop keeps the historical nav + CTA layout; mobile uses a hamburger sheet.
 * Leftover guest JWTs are treated as logged out (SCW-30).
 * Client portal CTAs use /portal (SCW-32).
 */
export function Header() {
  const router = useRouter();
  const { user, ready, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const fullAccount = isFullAccount(user);
  const authInput = {
    ready,
    role: fullAccount ? (user!.role ?? null) : null,
  };
  const desktopNavItems = getMarketingDesktopNavItems(authInput);
  const mobileItems = getMarketingMobileMenuItems(authInput);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.push("/login");
  };

  const renderNavItem = (
    item: MarketingNavItem,
    opts: { onNavigate?: () => void; className?: string }
  ) => {
    if (isMarketingNavAction(item)) {
      return (
        <button
          key={item.id}
          type="button"
          className={cn(
            "text-left hover:text-primary transition-colors",
            opts.className
          )}
          onClick={() => void handleLogout()}
        >
          {item.label}
        </button>
      );
    }

    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={opts.onNavigate}
        className={cn(
          "hover:text-primary transition-colors",
          item.emphasize && "text-foreground font-semibold",
          item.id === "book" && "font-semibold text-foreground",
          opts.className
        )}
      >
        {item.label}
      </Link>
    );
  };

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

        <nav
          className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground"
          aria-label="Main"
        >
          {desktopNavItems.map((item) => renderNavItem(item, {}))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {ready && fullAccount ? (
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => void handleLogout()}
            >
              Log out
            </Button>
          ) : ready ? (
            <Link
              href="/signup"
              className="hidden md:inline text-sm font-semibold text-foreground hover:text-primary"
            >
              Sign up
            </Link>
          ) : null}

          <Link href={MARKETING_BOOK_CTA.href} className="shrink-0">
            <Button size="sm" className="md:px-[26px] md:py-[12px] md:text-sm">
              <span className="md:hidden">Book a Collection</span>
              <span className="hidden md:inline">
                {MARKETING_BOOK_CTA.label}
              </span>
            </Button>
          </Link>

          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 md:hidden text-[#000b49] hover:bg-transparent hover:text-primary"
                aria-label="Open menu"
              >
                <Menu className="size-6" aria-hidden />
              </Button>
            </DialogTrigger>
            <DialogContent
              showCloseButton
              className={cn(
                "fixed inset-y-0 right-0 left-auto top-0 z-50 flex h-dvh max-h-dvh w-[min(100%,20rem)] max-w-sm translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-l p-0 shadow-lg",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
                "data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 duration-200"
              )}
            >
              <DialogHeader className="border-b px-5 py-4 text-left">
                <DialogTitle className="text-base font-semibold">
                  Menu
                </DialogTitle>
              </DialogHeader>
              <nav
                className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4 text-base font-medium text-muted-foreground"
                aria-label="Mobile"
              >
                {mobileItems.map((item) =>
                  renderNavItem(item, {
                    onNavigate: () => setMenuOpen(false),
                    className: cn(
                      "rounded-md px-3 py-3",
                      isMarketingNavAction(item) && "w-full"
                    ),
                  })
                )}
              </nav>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
