import { branchContacts } from "@/data/branchContacts";
import { MapPin, Phone, Mail, ExternalLink } from "lucide-react";

const formatTel = (phone: string) => {
  const digits = phone.replace(/[^0-9]/g, "");
  return `tel:${digits.startsWith("0") ? "+27" + digits.slice(1) : digits}`;
};

const ContactPage = () => {
  const mapsEmbedUrl = (query: string, zoom = 17) =>
    `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=h&z=${zoom}&output=embed`;

  return (
    <div className="container mx-auto px-4 py-20">
      <div className="max-w-4xl mx-auto text-center mb-12">
        <p className="text-sm uppercase tracking-[0.3em] text-primary font-semibold">Get In Touch</p>
        <h1 className="text-4xl font-extrabold mt-4 mb-2">Contact Spark & Clean</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Need support or want to drop off a rug? Reach out to our Gauteng and Cape Town branches directly.
        </p>
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
                  src={mapsEmbedUrl(branch.googleMapsQuery)}
                  title={`${branch.name} location map`}
                  className="h-full w-full object-cover border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

              <div className="p-6">
                <h3 className="text-2xl font-semibold">{title}</h3>
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
                        <p key={phone.number} className="text-sm"><a href={formatTel(phone.number)} className="text-primary hover:underline">{phone.number}</a></p>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded bg-muted/30"><Mail className="w-5 h-5 text-muted-foreground" /></div>
                    <div>
                      <p className="text-sm"><a href={`mailto:${branch.email}`} className="text-primary hover:underline">{branch.email}</a></p>
                    </div>
                  </div>

                  <div className="mt-2">
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(branch.googleMapsQuery)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                      Get directions <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="max-w-4xl mx-auto mt-12 bg-teal-50 rounded-xl p-8">
        <h3 className="text-xl font-semibold">Spark & Clean</h3>
        <p className="text-muted-foreground mt-2">Trusted rug cleaning with collection and support in Gauteng and Cape Town.</p>
      </div>
    </div>
  );
};

export default ContactPage;
