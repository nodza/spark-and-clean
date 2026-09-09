/**
 * /booking/[id] stays publicly reachable at the route level (middleware).
 * Guest track works without a session; page-level UX handles claim/convert.
 */
export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
