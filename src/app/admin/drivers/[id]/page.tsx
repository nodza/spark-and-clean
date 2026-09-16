import { redirect } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";

/** Old driver bookmarks use `driver_1`; technician pages use the User id. */
export default async function DriverRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connectDB();

  const byProfile = await User.findOne({
    role: "technician",
    driverProfileId: id,
  })
    .select("_id")
    .lean();
  if (byProfile) {
    redirect(`/admin/technicians/${String(byProfile._id)}`);
  }

  if (isValidObjectId(id)) {
    const byUser = await User.findOne({ _id: id, role: "technician" })
      .select("_id")
      .lean();
    if (byUser) {
      redirect(`/admin/technicians/${String(byUser._id)}`);
    }
  }

  redirect("/admin/technicians");
}
