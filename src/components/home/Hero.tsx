"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const HERO_VIDEO =
  "https://www.sparkandclean.co.za/wp-content/uploads/2025/05/IMG_0815-2.mov";
const HERO_POSTER =
  "https://www.sparkandclean.co.za/wp-content/uploads/revslider/video-media/IMG_0815-2_29.jpeg";

export function Hero() {
  const [videoReady, setVideoReady] = useState(false);

  return (
    <section
      className="relative isolate flex min-h-[min(85vh,720px)] items-center overflow-hidden max-md:landscape:min-h-[100svh]"
      aria-labelledby="hero-heading"
    >
      {/* Crisp fallback thumbnail — visible until video can play */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HERO_POSTER}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 -z-20 h-full w-full object-cover"
        fetchPriority="high"
      />

      <video
        className={cn(
          "absolute inset-0 -z-10 h-full w-full object-cover transition-opacity duration-700",
          videoReady ? "opacity-100" : "opacity-0"
        )}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={HERO_POSTER}
        aria-hidden="true"
        onCanPlay={() => setVideoReady(true)}
        onLoadedData={() => setVideoReady(true)}
      >
        <source src={HERO_VIDEO} type="video/mp4" />
        <source src={HERO_VIDEO} type="video/quicktime" />
      </video>

      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/80 via-primary/65 to-primary/85"
        aria-hidden="true"
      />

      <div className="container mx-auto px-4 py-16 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center text-primary-foreground">
          <h1
            id="hero-heading"
            className="mb-5 text-balance text-3xl font-extrabold tracking-tight sm:mb-6 sm:text-4xl md:text-5xl lg:text-6xl"
          >
            Results You Can See, Service You Can Trust
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-pretty text-base leading-relaxed text-primary-foreground/95 sm:mb-12 sm:text-lg lg:text-xl">
            Our advanced system will fully clean a rug in 7 minutes and dry it
            to 96% within 7 minutes. Serving all Gauteng and Cape Town
            surrounding areas.
          </p>

          <Button
            asChild
            size="lg"
            className="min-h-12 w-full px-8 text-base font-semibold shadow-lg sm:w-auto sm:min-w-[240px] bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Link href="/book/rug">
              Book a Rug Collection
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
