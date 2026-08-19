import { buildMetadata, pageSeo } from "@/lib/seo";

export const metadata = buildMetadata(pageSeo.bookRug);

export default function BookRugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
