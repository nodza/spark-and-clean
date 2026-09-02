import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";

type ServicePageProps = {
  eyebrow: string;
  heading: string;
  lead: string;
  highlights: string[];
  ctaHref?: string;
  ctaLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function ServicePageContent({
  eyebrow,
  heading,
  lead,
  highlights,
  ctaHref = "/book/rug",
  ctaLabel = "Book a Collection",
  secondaryHref = "/contact",
  secondaryLabel = "Chat with support",
}: ServicePageProps) {
  return (
    <div className="flex flex-col">
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-accent/5 py-16 lg:py-24">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
            {eyebrow}
          </p>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-primary lg:text-5xl">
            {heading}
          </h1>
          <p className="mb-8 text-lg text-muted-foreground">{lead}</p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href={ctaHref}>
              <Button size="lg" className="h-12 w-full px-8 text-lg sm:w-auto">
                {ctaLabel} <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href={secondaryHref}>
              <Button
                variant="outline"
                size="lg"
                className="h-12 w-full px-8 text-lg sm:w-auto"
              >
                {secondaryLabel}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="container mx-auto max-w-3xl px-4">
          <h2 className="mb-8 text-center text-2xl font-bold">
            Why choose Spark & Clean
          </h2>
          <ul className="space-y-4">
            {highlights.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-xl bg-secondary/20 p-4"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
