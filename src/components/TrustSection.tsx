import React from "react";
import { Star } from "lucide-react";

type Client = {
  name: string;
  src: string;
  alt?: string;
};

const clients: Client[] = [
  { name: "Radisson Hotels", src: "https://www.sparkandclean.co.za/wp-content/uploads/2022/04/1-radisson-logo.jpg", alt: "Radisson Hotels" },
  { name: "Torga Optical", src: "https://www.sparkandclean.co.za/wp-content/uploads/2022/04/2-torga-logo.jpg", alt: "Torga Optical" },
  { name: "Sefar", src: "https://www.sparkandclean.co.za/wp-content/uploads/2022/04/3-sefar-logo.jpg", alt: "Sefar" },
  { name: "Ukko", src: "https://www.sparkandclean.co.za/wp-content/uploads/2022/04/4-ukko-logo.jpg", alt: "Ukko" },
  { name: "Jonsson Workwear", src: "https://www.sparkandclean.co.za/wp-content/uploads/2023/03/jonsson-workwear-logo.jpg", alt: "Jonsson Workwear" },
  { name: "Skye College", src: "https://www.sparkandclean.co.za/wp-content/uploads/2022/04/5-skye-college-logo.jpg", alt: "Skye College" }
];

export function TrustSection() {
  return (
    <section className="py-16 bg-secondary/10 border-y">
      <div className="container px-4 mx-auto">
        <h3 className="text-center text-sm font-semibold text-muted-foreground mb-8 uppercase tracking-wider">
          Trusted by Leading Organizations
        </h3>

        {/* Responsive grid: 2 mobile, 3 tablet, 6 desktop */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 items-center">
          {clients.map((c) => (
            <div key={c.name} className="flex items-center justify-center p-4 bg-white/0">
              <div className="h-16 flex items-center justify-center">
                <img
                  src={c.src}
                  alt={c.alt ?? c.name}
                  className="max-h-12 object-contain grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Static Google review card */}
          <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl shadow-sm">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-extrabold">4.8</div>
              <div className="flex items-center text-accent">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-current text-accent" />
                ))}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              EXCELLENT — Rating on Google Reviews
              <div className="text-xs">Based on verified customer reviews</div>
            </div>
          </div>

          {/* Trustindex placeholder / badge */}
          <div className="ml-auto">
            <a href="#" className="inline-flex items-center gap-3 bg-white/5 p-3 rounded-lg">
              <div className="font-semibold">Trustindex</div>
              <div className="text-sm text-muted-foreground">Google Rating 4.8</div>
            </a>
          </div>
        </div>

        {/* TODO: Confirm logo usage & quality with Noel before publishing. */}
        <div className="sr-only">TODO: Confirm logo permissions with Noel</div>
      </div>
    </section>
  );
}

export default TrustSection;
