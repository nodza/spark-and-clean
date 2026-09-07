import Link from "next/link";
import { branchContacts } from "@/data/branchContacts";
import { MapPin, Phone, Mail, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { ChatWithSupportLink } from "@/components/support/ChatWithSupportLink";
import { SUPPORT_WHATSAPP_PREFILL, telHref, whatsappHref } from "@/lib/phone";
import { buildMetadata, pageSeo } from "@/lib/seo";

export const metadata = buildMetadata(pageSeo.contact);

const ContactPage = () => {
  return (
    <div className="container mx-auto px-4 py-16 sm:py-20">
      <div className="max-w-4xl mx-auto text-center mb-12">
        <p className="text-sm uppercase tracking-[0.3em] text-primary font-semibold">Get In Touch</p>
        <h1 className="text-4xl font-extrabold mt-4 mb-2">Contact Spark & Clean</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Book collections online. For questions, drop-off, or help with your booking, reach our Gauteng and Cape Town branches.
        </p>
        <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg" className="min-h-12 w-full px-8 sm:w-auto">
            <Link href="/book/rug">Book a collection</Link>
          </Button>
          <ChatWithSupportLink variant="button" />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {branchContacts.map((branch) => {
          const addressLines = branch.addressLines ?? branch.address.split(",").map((s) => s.trim());
          const [subtitle, title] = branch.location.includes(",")
            ? [branch.location.split(",")[0].trim(), branch.location.split(",")[1].trim()]
            : [branch.location, branch.name];

          return (
            <article key={branch.name} className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="h-56 sm:h-64 md:h-60 lg:h-56 overflow-hidden">
                <iframe
                  src={branch.mapsEmbedUrl}
                  title={`${branch.name} location map`}
                  className="h-full w-full object-cover border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>

              <div className="p-6">
                <h2 className="text-2xl font-semibold">{title}</h2>
                <p className="text-sm text-muted-foreground mb-4">{subtitle}</p>

                <div className="border-t pt-4 mb-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded bg-muted/30"><MapPin className="w-5 h-5 text-muted-foreground" /></div>
                    <div>
                      <p className="text-sm font-semibold">{addressLines[0]}</p>
                      <p className="text-sm text-muted-foreground mt-1">{addressLines.slice(1).join(", ")}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded bg-muted/30"><Phone className="w-5 h-5 text-muted-foreground" /></div>
                    <div>
                      {branch.phones.map((phone) => (
                        <p key={phone.number} className="text-sm">
                          <a href={telHref(phone.number)} className="text-primary hover:underline">
                            {phone.number}
                          </a>
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded bg-[#25D366]/10"><WhatsAppIcon className="size-5" /></div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        WhatsApp support
                      </p>
                      <p className="text-sm">
                        <a
                          href={whatsappHref(branch.whatsapp, SUPPORT_WHATSAPP_PREFILL)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {branch.whatsapp}
                        </a>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded bg-muted/30"><Mail className="w-5 h-5 text-muted-foreground" /></div>
                    <div>
                      <p className="text-sm">
                        <a href={`mailto:${branch.email}`} className="text-primary hover:underline">
                          {branch.email}
                        </a>
                      </p>
                    </div>
                  </div>

                  <div className="mt-2">
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(branch.googleMapsQuery)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      Get directions <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default ContactPage;
