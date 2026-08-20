import { buildMetadata, pageSeo } from "@/lib/seo";
import { ServicePageContent } from "@/components/marketing/ServicePageContent";

export const metadata = buildMetadata(pageSeo.residentialCleaning);

export default function ResidentialCleaningPage() {
  return (
    <ServicePageContent
      eyebrow="At home"
      heading="Residential Carpet & Upholstery Cleaning"
      lead="Extend that fresh feeling through your home with call-out services for fitted carpets, couches, mattresses and upholstery — performed by skilled technicians in Cape Town and Gauteng."
      highlights={[
        "Deep carpet cleaning and stain removal for homes near you",
        "Couch, armchair and dining chair upholstery cleaning",
        "Hygienic mattress cleaning and sanitation",
        "Flexible scheduling that fits busy household routines",
      ]}
      ctaHref="/contact"
      ctaLabel="Request a Home Visit"
      secondaryHref="/book/rug"
      secondaryLabel="Book Rug Collection"
    />
  );
}
