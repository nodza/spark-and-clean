import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { Booking } from "@/models/Booking";
import { RugAsset } from "@/models/RugAsset";
import { connectDB } from "@/lib/mongodb";
import { isHttpError, requireFullAdminSession } from "@/lib/adminAuth";
import { getSession } from "@/lib/session";

type Params = { params: Promise<{ tagCode: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { tagCode: rawTagCode } = await params;
    const tagCode = rawTagCode.trim().toUpperCase();
    if (!tagCode) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    const asset = await RugAsset.findOne({ tagCode }).lean();
    if (!asset) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    if (session.role === "admin") {
      requireFullAdminSession(session);
    } else if (session.role === "technician" && session.driverProfileId) {
      if (!asset.currentBookingId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const booking = await Booking.findOne({ id: asset.currentBookingId })
        .select({ assignedDriverId: 1 })
        .lean();
      if (booking?.assignedDriverId !== session.driverProfileId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const png = await QRCode.toBuffer(tagCode, {
      errorCorrectionLevel: "M",
      margin: 4,
      width: 768,
      color: { dark: "#000000", light: "#FFFFFF" },
    });

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="${tagCode}.png"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to generate QR code";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}