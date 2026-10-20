import { NextResponse } from "next/server";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import {
  CLIENT_DIRECTORY_SELECT,
  clientDirectoryFilter,
  directoryWindow,
  toClientDirectoryRow,
} from "@/lib/clientDirectory";
import { parseListPagination } from "@/lib/listPagination";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";

function jsonError(err: unknown, fallback: string) {
  if (isHttpError(err)) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : fallback;
  console.error("[api/admin/clients]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Read-only client directory. Full admins only. */
export async function GET(request: Request) {
  try {
    await requireFullAdmin();
    await connectDB();

    const url = new URL(request.url);
    const filter = clientDirectoryFilter(url.searchParams.get("q") ?? "");
    const total = await User.countDocuments(filter);
    const window = directoryWindow(total, parseListPagination(url.searchParams));

    const docs =
      total === 0
        ? []
        : await User.find(filter)
            .select(CLIENT_DIRECTORY_SELECT)
            .sort({ name: 1, email: 1 })
            .skip(window.skip)
            .limit(window.limit)
            .lean();

    const clients = docs
      .map((doc) => toClientDirectoryRow(doc as Record<string, unknown>))
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return NextResponse.json({
      clients,
      total,
      page: window.page,
      limit: window.limit,
    });
  } catch (err) {
    return jsonError(err, "Failed to list clients");
  }
}
