import { redirect } from "next/navigation";

export default function DriversRedirect() {
  redirect("/admin/technicians");
}
