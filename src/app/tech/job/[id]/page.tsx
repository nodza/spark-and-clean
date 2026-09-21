import { TechJobDetailClient } from "./TechJobDetailClient";

/** Server entry — avoids Next 16 client-page segment config / prefetch crash. */
export default function TechJobDetailPage() {
  return <TechJobDetailClient />;
}
