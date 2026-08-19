import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sparkandclean.co.za";

export const SITE_NAME = "Spark & Clean";

/** Global default — refined from legacy WordPress with location + service keywords */
export const GLOBAL_DESCRIPTION =
  "Automatic rug cleaning in Kya Sand & Maitland. 7-minute clean and 7-minute dry. Residential and commercial carpet, upholstery, and Persian rug cleaning across Gauteng and Cape Town.";

export type PageSeo = {
  title: string;
  description: string;
  path: string;
  /** Include in public sitemap (default true) */
  indexable?: boolean;
};

export const pageSeo = {
  home: {
    title: "Spark & Clean | Automatic Rug Cleaning and Drying Services",
    description: GLOBAL_DESCRIPTION,
    path: "/",
  },
  automaticRugCleaning: {
    title: "Spark & Clean | Automatic Rug Cleaning & Drying",
    description:
      "South Africa's first automatic rug cleaning system — fully clean in 7 minutes, dry to 96% in 7 minutes. Eco-friendly care for Persian, Kilim, Afghan, Paco and modern rugs. Collection from Kya Sand & Cape Town.",
    path: "/services/automatic-rug-cleaning",
  },
  persianRugCleaning: {
    title: "Spark & Clean | Persian Rug Cleaning Services",
    description:
      "Specialist Persian and handmade rug cleaning with automatic machines. Gentle, precise care for delicate fibres — restore colour and texture. Serving Johannesburg, Gauteng and Cape Town.",
    path: "/services/persian-rug-cleaning",
  },
  residentialCleaning: {
    title: "Spark & Clean | Residential Carpet & Upholstery Cleaning",
    description:
      "Residential carpet, upholstery, couch and mattress cleaning near you. Call-out services across Gauteng and Cape Town — deep clean, stain removal and hygienic home care.",
    path: "/services/residential-cleaning",
  },
  commercialCleaning: {
    title: "Spark & Clean | Commercial Cleaning Services Johannesburg",
    description:
      "Commercial carpet and upholstery cleaning for offices, hotels and retail in Johannesburg and Cape Town. Reliable scheduling for businesses that need spotless floors and furnishings.",
    path: "/services/commercial-cleaning",
  },
  contact: {
    title: "Spark & Clean | Contact Us — Cape Town & Johannesburg",
    description:
      "Get in touch with Spark & Clean for rug collection, quotes and commercial cleaning. Cape Town and Johannesburg phone lines, email and branch locations in Kya Sand & Maitland.",
    path: "/contact",
  },
  bookRug: {
    title: "Spark & Clean | Book Rug Cleaning Collection",
    description:
      "Book online rug collection in minutes. Enter measurements, upload photos, choose a slot — we collect, clean, dry and deliver across Cape Town and Johannesburg.",
    path: "/book/rug",
  },
} as const satisfies Record<string, PageSeo>;

/** Public marketing routes for sitemap.xml */
export const sitemapEntries: PageSeo[] = [
  pageSeo.home,
  pageSeo.automaticRugCleaning,
  pageSeo.persianRugCleaning,
  pageSeo.residentialCleaning,
  pageSeo.commercialCleaning,
  pageSeo.contact,
  pageSeo.bookRug,
];

export function buildMetadata({
  title,
  description,
  path,
  indexable = true,
}: PageSeo): Metadata {
  const url = path === "/" ? SITE_URL : `${SITE_URL}${path}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "en_ZA",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
  };
}
