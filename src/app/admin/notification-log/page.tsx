import { redirect } from "next/navigation";
import { AdminPortalShell } from "@/components/admin/AdminPortalShell";
import { requirePageSession } from "@/lib/requirePageSession";
import { connectDB } from "@/lib/mongodb";
import { NotificationAttempt } from "@/models/NotificationAttempt";

const RECENT_ATTEMPTS_LIMIT = 200;

function formatAttemptTime(value: Date | string | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  }).format(date);
}

function resultStyle(result: string) {
  if (result === "delivered") return "bg-[#e8f7f1] text-[#126b4d]";
  if (result === "sent") return "bg-[#edf2ff] text-[#294a9b]";
  if (result === "failed") return "bg-[#fff0ed] text-[#a23b2c]";
  return "bg-[#f0f2f5] text-[#596273]";
}

export default async function NotificationLogPage() {
  const session = await requirePageSession({
    roles: ["admin"],
    loginPath: "/admin/login",
    nextPath: "/admin/notification-log",
    allowGuest: false,
  });
  if (session.adminTier !== "full") redirect("/admin?access=denied");

  await connectDB();
  const attempts = await NotificationAttempt.find()
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(RECENT_ATTEMPTS_LIMIT)
    .select({ bookingId: 1, status: 1, result: 1, createdAt: 1, updatedAt: 1 })
    .lean();

  return (
    <AdminPortalShell pageTitle="Notification log" active="notification-log">
      <main className="portal-page">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-extrabold text-[#000b49]">
              Notification log
            </h1>
            <p className="mt-1 text-[13px] text-[#697386]">
              Recent WhatsApp booking status messages
            </p>
          </div>
          <p className="text-[12px] font-semibold tabular-nums text-[#697386]">
            Latest {attempts.length}
          </p>
        </div>

        <div className="overflow-x-auto rounded-[8px] border border-[#e5e8ee] bg-white">
          <table className="w-full min-w-[620px] border-collapse text-left text-[13px]">
            <thead className="bg-[#f7f8fa] text-[11px] uppercase text-[#697386]">
              <tr>
                <th className="px-4 py-3 font-bold">Booking ID</th>
                <th className="px-4 py-3 font-bold">Template status</th>
                <th className="px-4 py-3 font-bold">Result</th>
                <th className="px-4 py-3 font-bold">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f4]">
              {attempts.map((attempt) => {
                const result = String(attempt.result || "unknown");
                return (
                  <tr key={String(attempt._id)}>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#17213a]">
                      {attempt.bookingId}
                    </td>
                    <td className="px-4 py-3 text-[#39445a]">{attempt.status}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-[5px] px-2 py-1 text-[11px] font-bold capitalize ${resultStyle(result)}`}
                      >
                        {result}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#697386]">
                      {formatAttemptTime(attempt.updatedAt ?? attempt.createdAt)}
                    </td>
                  </tr>
                );
              })}
              {attempts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-[#697386]">
                    No WhatsApp status attempts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </AdminPortalShell>
  );
}