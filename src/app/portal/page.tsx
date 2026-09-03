import { redirect } from "next/navigation";

/** Client portal lives at /dashboard. Guests are sent to /login by that layout. */
export default function PortalRedirect() {
  redirect("/dashboard");
}
