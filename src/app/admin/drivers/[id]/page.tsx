import { redirect } from "next/navigation";

export default async function DriverRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/technicians/${id}`);
}
