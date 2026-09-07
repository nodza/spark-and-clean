import { branchContacts } from "@/data/branchContacts";
import { MapPin, Phone, Mail } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { SUPPORT_WHATSAPP_PREFILL, telHref, whatsappHref } from "@/lib/phone";

export function Footer() {
  return (
    <footer className="border-t bg-secondary/30 pt-10 pb-24 sm:pb-10">
      <div className="container px-4 mx-auto grid gap-10 lg:grid-cols-2 items-start">
        <div>
          <h3 className="font-bold text-2xl text-primary mb-3">Spark & Clean</h3>
          <p className="text-muted-foreground max-w-xl">
            Trusted rug cleaning with collection and support in Gauteng and Cape Town.
            Book online — WhatsApp is for questions and assistance.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {branchContacts.map((branch) => (
            <div key={branch.name} className="rounded-3xl border border-border bg-white p-6 shadow-sm">
              <h4 className="text-lg font-semibold text-foreground mb-4">{branch.name}</h4>
              <div className="space-y-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Address</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.googleMapsQuery)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block text-sm font-semibold text-primary hover:underline"
                    >
                      {branch.address}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Phones</p>
                    <div className="mt-1 space-y-1">
                      {branch.phones.map((phone) => (
                        <a
                          key={phone.number}
                          href={telHref(phone.number)}
                          className="block text-sm font-semibold text-primary hover:underline"
                        >
                          {phone.number}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Email</p>
                    <a
                      href={`mailto:${branch.email}`}
                      className="mt-1 block text-sm font-semibold text-primary hover:underline"
                    >
                      {branch.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#25D366]/10">
                    <WhatsAppIcon className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">WhatsApp support</p>
                    <a
                      href={whatsappHref(branch.whatsapp, SUPPORT_WHATSAPP_PREFILL)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-sm font-semibold text-primary hover:underline"
                    >
                      {branch.whatsapp}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
