import type { NextConfig } from "next";

/**
 * Legacy WordPress → Next.js permanent redirects (HTTP 301).
 * Next.js strips trailing slashes with 308 first when trailingSlash is false,
 * so sources are listed without a trailing slash.
 */
const legacyRedirects: { source: string; destination: string }[] = [
  { source: "/rugsallday", destination: "/services/automatic-rug-cleaning" },
  {
    source: "/persian-rug-cleaning",
    destination: "/services/persian-rug-cleaning",
  },
  {
    source: "/persian-rug-cleaning-services",
    destination: "/services/persian-rug-cleaning",
  },
  {
    source: "/carpet-cleaning-near-me-rugs",
    destination: "/services/residential-cleaning",
  },
  {
    source: "/carpet-upholstery-cleaners-gauteng",
    destination: "/services/residential-cleaning",
  },
  {
    source: "/commercial-cleaning-services-johannesburg",
    destination: "/services/commercial-cleaning",
  },
  { source: "/get-in-touch", destination: "/contact" },
  { source: "/cleanmyrug", destination: "/book/rug" },
  { source: "/feed", destination: "/" },
];

const nextConfig: NextConfig = {
  async redirects() {
    return legacyRedirects.map(({ source, destination }) => ({
      source,
      destination,
      statusCode: 301 as const,
    }));
  },
};

export default nextConfig;
