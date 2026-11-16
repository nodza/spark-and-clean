import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import { generateTemporaryPassword } from "@/lib/temporaryPassword";
import { validateCustomerName, validateEmail } from "@/lib/bookingValidation";

const createWorkshopStaffSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .refine((value) => !validateCustomerName(value), {
      message: "Enter a valid name",
    })
    .transform((value) => value.replace(/\s+/g, " ")),
  email: z
    .string()
    .trim()
    .refine((value) => !validateEmail(value), {
      message: "Enter a valid email address",
    })
    .transform((value) => value.toLowerCase()),
});

type WorkshopStaffDoc = {
  _id: { toString(): string };
  name?: unknown;
  email?: unknown;
  disabledAt?: Date | string | null;
  isActive?: boolean | null;
};

function toWorkshopStaff(doc: WorkshopStaffDoc) {
  return {
    id: String(doc._id),
    name: typeof doc.name === "string" ? doc.name : "",
    email: typeof doc.email === "string" ? doc.email : "",
    active: !doc.disabledAt && doc.isActive !== false,
  };
}

function jsonError(err: unknown, fallback: string) {
  if (isHttpError(err)) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : fallback;
  console.error("[api/admin/workshop-staff]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === 11000
  );
}

export async function GET() {
  try {
    await requireFullAdmin();
    await connectDB();
    const docs = await User.find({ role: "workshop" })
      .sort({ name: 1, email: 1 })
      .lean();
    return NextResponse.json({
      workshopStaff: docs.map((doc) =>
        toWorkshopStaff(doc as WorkshopStaffDoc)
      ),
    });
  } catch (err) {
    return jsonError(err, "Failed to list workshop accounts");
  }
}

export async function POST(request: Request) {
  try {
    await requireFullAdmin();
    const parsed = createWorkshopStaffSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid staff details" },
        { status: 400 }
      );
    }

    await connectDB();
    const existing = await User.findOne({ email: parsed.data.email })
      .select("role")
      .lean();
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const user = await User.create({
      ...parsed.data,
      passwordHash,
      role: "workshop",
      adminTier: null,
      emailVerifiedAt: null,
      emailVerified: false,
      disabledAt: null,
      isActive: true,
      mustChangePassword: true,
      marketingOptIn: false,
    });

    return NextResponse.json(
      {
        workshopStaff: toWorkshopStaff({
          _id: user._id,
          name: user.name,
          email: user.email,
          disabledAt: user.disabledAt,
          isActive: user.isActive,
        }),
        temporaryPassword,
      },
      { status: 201 }
    );
  } catch (err) {
    if (isDuplicateKey(err)) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }
    return jsonError(err, "Failed to create workshop account");
  }
}
