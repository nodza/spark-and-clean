import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { PromoVideos } from "@/components/home/PromoVideos";
import { HomePortalCta } from "@/components/home/HomePortalCta";
import TrustSection from "@/components/TrustSection";
import { buildMetadata, pageSeo } from "@/lib/seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = buildMetadata(pageSeo.home);

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <Hero />

      {/* How It Works */}
      <HowItWorks />

      {/* Why Tech-Enabled? */}
      <section data-contrast="dark" className="py-20 bg-primary text-primary-foreground">
        <div className="container px-4 mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">Why Tech-Enabled Cleaning?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Real-Time Tracking", desc: "Know exactly when your rug is collected, cleaned, and out for delivery." },
              { title: "Automated Scheduling", desc: "Book a slot that fits your life instantly. No back-and-forth calls." },
              { title: "Digital Quality Checks", desc: "Every rug is photographed and inspected digitally before and after cleaning." }
            ].map((item, i) => (
              <div key={i} className="bg-white/10 p-6 rounded-xl backdrop-blur-sm">
                <h3 className="text-xl font-bold mb-2 text-accent">{item.title}</h3>
                <p className="opacity-90">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Showcase */}
      <PromoVideos />

      {/* Services */}
      <section className="py-20 bg-secondary/10">
        <div className="container px-4 mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Our Specialist Services</h2>
            <p className="text-muted-foreground text-lg">Specialist care for every rug and fabric in your home.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-primary/20 shadow-md hover:shadow-lg transition-shadow cursor-pointer relative overflow-hidden group">
              <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> Rug Cleaning
                </CardTitle>
                <CardDescription>Persian, Shaggy, Wool & more</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Deep wash, stain removal, and fringe whitening.</p>
                <Link href="/book/rug">
                  <Button className="w-full">Book Now</Button>
                </Link>
              </CardContent>
            </Card>

            {[
              { title: "Upholstery", desc: "Couches, armchairs & dining chairs" },
              { title: "Mattresses", desc: "Deep clean & sanitation" },
              { title: "Tiles & Grout", desc: "High pressure cleaning" }
            ].map((service, i) => (
              <Card key={i} className="opacity-75 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                <CardHeader>
                  <CardTitle>{service.title}</CardTitle>
                  <CardDescription>Coming Soon</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{service.desc}</p>
                  <Button variant="secondary" disabled className="w-full">Waitlist</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof & Areas */}
      <TrustSection />

      {/* Returning customers — same portal destinations as header / hero */}
      <HomePortalCta />
    </div>
  );
}
