import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buildMetadata, pageSeo } from "@/lib/seo";
import { Mail, MapPin, Phone } from "lucide-react";

export const metadata = buildMetadata(pageSeo.contact);

export default function ContactPage() {
  return (
    <div className="flex flex-col">
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-accent/5 py-16 lg:py-24">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-primary lg:text-5xl">
            Contact Spark & Clean
          </h1>
          <p className="mb-8 text-lg text-muted-foreground">
            Reach us for rug collection quotes, residential call-outs or commercial
            cleaning programmes in Cape Town and Johannesburg.
          </p>
          <Link href="/book/rug">
            <Button size="lg" className="h-12 px-8 text-lg">
              Book Online Instead
            </Button>
          </Link>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="container mx-auto grid max-w-4xl gap-8 px-4 md:grid-cols-3">
          <div className="rounded-xl bg-secondary/20 p-6">
            <Phone className="mb-4 h-8 w-8 text-primary" />
            <h2 className="mb-3 text-lg font-semibold">Phone</h2>
            <p className="text-sm text-muted-foreground">
              Gauteng: 064 289 2384 / 068 729 2869
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Cape Town: 064 043 6902 / 063 853 4499
            </p>
          </div>
          <div className="rounded-xl bg-secondary/20 p-6">
            <Mail className="mb-4 h-8 w-8 text-primary" />
            <h2 className="mb-3 text-lg font-semibold">Email</h2>
            <a
              href="mailto:hello@sparkandclean.co.za"
              className="text-sm text-primary hover:underline"
            >
              hello@sparkandclean.co.za
            </a>
          </div>
          <div className="rounded-xl bg-secondary/20 p-6">
            <MapPin className="mb-4 h-8 w-8 text-primary" />
            <h2 className="mb-3 text-lg font-semibold">Locations</h2>
            <p className="text-sm text-muted-foreground">
              Kya Sand, Johannesburg & Maitland, Cape Town — serving surrounding
              areas.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
