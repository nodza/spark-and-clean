import { Star } from "lucide-react";

type Client = {
  name: string;
  src: string;
  alt?: string;
};

const clients: Client[] = [
  { 
    name: "Radisson Hotels", 
    src: "https://www.sparkandclean.co.za/wp-content/uploads/2022/04/1-radisson-logo.jpg", 
    alt: "Radisson Hotels" 
  },
  { 
    name: "Torga Optical", 
    src: "https://www.sparkandclean.co.za/wp-content/uploads/2022/04/2-torga-logo.jpg", 
    alt: "Torga Optical" 
  },
  { 
    name: "Sefar", 
    src: "https://www.sparkandclean.co.za/wp-content/uploads/2022/04/3-sefar-logo.jpg", 
    alt: "Sefar" 
  },
  { 
    name: "Ukko", 
    src: "https://www.sparkandclean.co.za/wp-content/uploads/2022/04/4-ukko-logo.jpg",
    alt: "Ukko" 
  },
  { 
    name: "Jonsson Workwear", 
    src: "https://www.sparkandclean.co.za/wp-content/uploads/2023/03/jonsson-workwear-logo.jpg", 
    alt: "Jonsson Workwear" 
  },
  { 
    name: "Skye College", 
    src: "https://www.sparkandclean.co.za/wp-content/uploads/2022/04/5-skye-college-logo.jpg", 
    alt: "Skye College"
  }
];

export function TrustSection() {
  return (
    <section className="bg-white py-16">
      <div className="container mx-auto px-4">
        <h3 className="mb-10 text-center text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          Trusted by Leading Organizations
        </h3>

        <div className="grid grid-cols-2 items-center gap-8 md:grid-cols-3 lg:grid-cols-6">
          {clients.map((c) => (
            <div key={c.name} className="flex items-center justify-center">
              <div className="flex h-20 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.src}
                  alt={c.alt ?? c.name}
                  className="max-h-16 w-auto object-contain"
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
      </div>
    </section>
  );
}

export default TrustSection;
