import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface AuthLayoutProps {
  /** "CLIENT PORTAL" | "OPERATIONS" | etc. — eyebrow label on brand panel */
  portalLabel?: string;
  /** Main headline on the brand panel */
  tagline: React.ReactNode;
  /** Optional supporting text below the tagline */
  subtext?: React.ReactNode;
  /** Optional slot for extra content on the brand panel (e.g. feature list) */
  brandExtra?: React.ReactNode;
  /** Form content */
  children: React.ReactNode;
  className?: string;
}

/**
 * AuthLayout — Split-screen auth shell used by all auth pages.
 *
 * Spec (Auth.dc.html):
 *   Left  ~flex 1.05, background #000b49, logo + portal label + tagline + copyright
 *   Right flex 1, white, centered form slot max-w 380px
 *   Radial gradient accents: teal top-right, yellow bottom-left
 *   Mobile: left panel hidden, logo shown above form
 */
export function AuthLayout({
  portalLabel,
  tagline,
  subtext,
  brandExtra,
  children,
  className,
}: AuthLayoutProps) {
  return (
    <div className={cn("flex min-h-screen w-full bg-white", className)}>
      {/* ─── Left: Brand panel ──────────────────────────────────────────── */}
      <div
        className="relative hidden lg:flex flex-col justify-between overflow-hidden p-[52px]"
        style={{ flex: "1.05", background: "#000b49" }}
      >
        {/* Decorative radial gradients */}
        <div
          className="pointer-events-none absolute top-[-180px] right-[-160px] size-[520px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(108,243,213,.18), transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute bottom-[-200px] left-[-130px] size-[460px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,220,57,.10), transparent 70%)" }}
        />

        {/* Logo + portal label */}
        <div className="relative z-10">
          <div className="inline-flex items-center rounded-[12px] bg-white px-[14px] py-[10px]">
            <Image
              src="/uploads/spark-and-clean-22.png"
              alt="Spark & Clean"
              width={120}
              height={38}
              className="h-[38px] w-auto object-contain"
              priority
            />
          </div>
          {portalLabel && (
            <div className="mt-[15px] text-[10px] font-extrabold tracking-[0.22em] uppercase text-[#6cf3d5]">
              {portalLabel}
            </div>
          )}
        </div>

        {/* Tagline */}
        <div className="relative z-10 max-w-[430px]">
          <div
            className="text-white font-extrabold leading-[1.15]"
            style={{ fontSize: 38, letterSpacing: "-0.02em" }}
          >
            {tagline}
          </div>
          {subtext && (
            <div className="mt-5 text-[15px] leading-relaxed text-white/[0.62]">
              {subtext}
            </div>
          )}
          {brandExtra && <div className="mt-6">{brandExtra}</div>}
        </div>

        {/* Copyright */}
        <div className="relative z-10 text-[12.5px] text-white/40">
          Copyright {new Date().getFullYear()} Spark &amp; Clean.
        </div>
      </div>

      {/* ─── Right: Form panel ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 lg:px-10">
        {/* Mobile-only logo */}
        <div className="mb-[34px] lg:hidden">
          <Image
            src="/uploads/spark-and-clean-22.png"
            alt="Spark & Clean"
            width={100}
            height={32}
            className="h-8 w-auto object-contain"
            priority
          />
        </div>

        <div className="w-full max-w-[380px]">
          {children}
        </div>
      </div>
    </div>
  );
}
