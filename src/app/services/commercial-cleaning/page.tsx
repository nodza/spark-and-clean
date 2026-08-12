import { buildMetadata, pageSeo } from "@/lib/seo";
import { ServicePageContent } from "@/components/marketing/ServicePageContent";

export const metadata = buildMetadata(pageSeo.commercialCleaning);

export default function CommercialCleaningPage() {
  return (
    <ServicePageContent
      eyebrow="Business"
      heading="Commercial Cleaning Services"
      lead="Reliable carpet and upholstery cleaning for offices, hotels, retail and venues across Johannesburg and Cape Town. Trusted by brands that expect consistent, professional results."
      highlights={[
        "Scheduled commercial carpet and upholstery programmes",
        "Minimal disruption for busy workplaces and hospitality venues",
        "Proven results with clients including hotels, retail and corporate spaces",
        "Johannesburg, Gauteng and Cape Town coverage",
      ]}
      ctaHref="/contact"
      ctaLabel="Request a Commercial Quote"
      secondaryHref="/book/rug"
      secondaryLabel="Book Rug Collection"
    />
  );
}
