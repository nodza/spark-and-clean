/**
 * /booking/[id] stays publicly reachable at the route level (middleware).
 * Page-level client auth may still apply for live tracking UX.
 */
export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
