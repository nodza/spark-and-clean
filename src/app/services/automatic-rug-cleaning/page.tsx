import { buildMetadata, pageSeo } from "@/lib/seo";
import { ServicePageContent } from "@/components/marketing/ServicePageContent";

export const metadata = buildMetadata(pageSeo.automaticRugCleaning);

export default function AutomaticRugCleaningPage() {
  return (
    <ServicePageContent
      eyebrow="Automatic cleaning"
      heading="Automatic Rug Cleaning & Drying"
      lead="Our advanced system fully cleans a rug in 7 minutes and dries it to 96% within another 7 minutes — a first in South Africa. Serving Gauteng (Kya Sand) and Cape Town (Maitland)."
      highlights={[
        "7-minute clean and 7-minute dry with state-of-the-art automatic machines",
        "Safe, eco-friendly chemicals gentle on wool, silk and synthetic fibres",
        "Collection and delivery across Johannesburg, Gauteng and Cape Town",
        "Ideal for Persian, Kilim, Afghan, Kazakh, Paco, Shaggy and modern rugs",
      ]}
    />
  );
}
