"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const HERO_VIDEO = "/videos/hero.mp4";
const HERO_POSTER = "/videos/hero-poster.jpeg";

export function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const tryPlay = () => {
      void video.play().catch(() => {
        // Autoplay can still be blocked; poster remains visible.
      });
    };

    tryPlay();
    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);

    return () => {
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
    };
  }, []);

  return (
    <section
      className="relative isolate flex min-h-[min(85vh,720px)] items-center overflow-hidden max-md:landscape:min-h-[100svh]"
      aria-labelledby="hero-heading"
    >
      {/* Fallback thumbnail for slow connections / autoplay failure */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HERO_POSTER}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 -z-20 h-full w-full object-cover"
        fetchPriority="high"
      />

      <video
        ref={videoRef}
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={HERO_POSTER}
        aria-hidden="true"
      >
        <source src={HERO_VIDEO} type="video/mp4" />
      </video>

      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/55 via-primary/45 to-primary/70"
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
