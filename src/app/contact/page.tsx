import { branchContacts } from "@/data/branchContacts";
import { ExternalLink, Mail, MapPin, Phone } from "lucide-react";

const formatTel = (phone: string) => {
  const digits = phone.replace(/[^0-9]/g, "");
  return `tel:${digits.startsWith("0") ? "+27" + digits.slice(1) : digits}`;
};

const ContactPage = () => {
  const mapsEmbedUrl = (query: string) =>
    `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;

  return (
    <div className="container mx-auto px-4 py-20">
      <div className="max-w-4xl mx-auto text-center mb-16">
        <p className="text-sm uppercase tracking-[0.3em] text-primary font-semibold">Get In Touch</p>
        <h1 className="text-4xl font-extrabold mt-4 mb-4">Contact Spark & Clean</h1>
        <p className="text-muted-foreground text-lg">
          Need support or want to drop off a rug? Reach out to our Gauteng and Cape Town branches directly.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        {branchContacts.map((branch) => {
          const region = branch.location || branch.name;
          const addressLines = branch.addressLines ?? branch.address.split(",").map(s => s.trim());
          return (
            <section key={branch.name} className="rounded-3xl border border-border bg-white shadow-sm p-8">
              <h2 className="text-2xl font-bold mb-4">{region}</h2>

              <div className="text-sm text-muted-foreground mb-6">
                {addressLines.map((line, i) => (
                  <p key={i} className={i === 0 ? "" : "mt-1"}>{line}</p>
                ))}
              </div>

              <div className="text-sm text-muted-foreground mb-4">
                {branch.phones.map((phone) => (
                  <p key={phone.number} className="mt-1">Phone: <a href={formatTel(phone.number)} className="text-primary hover:underline">{phone.number}</a></p>
                ))}
              </div>

              <div className="text-sm text-muted-foreground mb-4">
                <p className="font-semibold">Email us:</p>
                <p className="mt-1"><a href={`mailto:${branch.email}`} className="text-primary hover:underline">{branch.email}</a></p>
              </div>

              <div className="mt-6 rounded-3xl overflow-hidden border border-border h-60">
                <iframe
                  src={mapsEmbedUrl(branch.googleMapsQuery)}
                  title={`${branch.name} location map`}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default ContactPage;
