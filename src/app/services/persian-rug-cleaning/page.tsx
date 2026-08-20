import { buildMetadata, pageSeo } from "@/lib/seo";
import { ServicePageContent } from "@/components/marketing/ServicePageContent";

export const metadata = buildMetadata(pageSeo.persianRugCleaning);

export default function PersianRugCleaningPage() {
  return (
    <ServicePageContent
      eyebrow="Persian & handmade"
      heading="Persian Rug Cleaning Services"
      lead="Specialist care for Persian and handmade rugs. Our automatic machines deliver a more thorough, consistent clean than traditional hand washing — protecting delicate fibres and restoring colour."
      highlights={[
        "Precision water pressure, brush speed and cleaning agents for handmade rugs",
        "Even cleaning across every fibre without damaging delicate knots",
        "Fringe care, colour restoration and odour elimination",
        "Convenient collection from your home or drop-off at our Kya Sand facility",
      ]}
    />
  );
}
