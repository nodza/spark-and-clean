import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import {
  emailTakenMessage,
  toAdminTeamMember,
  type AdminTeamMember,
} from "@/lib/adminTeam";
import { generateTemporaryPassword } from "@/lib/temporaryPassword";
import { validateCustomerName, validateEmail } from "@/lib/bookingValidation";
import { ADMIN_TIERS } from "@/types/user";

function refineWith(
  validator: (value: string) => string | null
): (value: string, ctx: z.RefinementCtx) => void {
  return (value, ctx) => {
    const message = validator(value);
    if (message) {
      ctx.addIssue({ code: "custom", message });
    }
  };
}

const createAdminBodySchema = z.object({
  name: z
    .string()
    .trim()
    .superRefine(refineWith(validateCustomerName))
    .transform((value) => value.trim().replace(/\s+/g, " ")),
  email: z
    .string()
    .trim()
    .superRefine(refineWith(validateEmail))
    .transform((value) => value.toLowerCase()),
  adminTier: z.enum(ADMIN_TIERS),
});

function jsonError(err: unknown, fallback: string) {
  if (isHttpError(err)) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : fallback;
  console.error("[api/admin/team]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

function isDuplicateKey(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return "code" in err && (err as { code: number }).code === 11000;
}

export async function GET() {
  try {
    await requireFullAdmin();
    await connectDB();

    // "ADMIN" is a legacy stored role, outside the current enum.
    const docs = await User.find({
      role: { $in: ["admin", "ADMIN"] },
    } as never)
      .sort({ name: 1, email: 1 })
      .lean();

    const admins: AdminTeamMember[] = [];
    for (const doc of docs) {
      const row = toAdminTeamMember(
        doc as {
          _id: { toString(): string };
          name?: unknown;
          email?: unknown;
          adminTier?: unknown;
          disabledAt?: Date | string | null;
          isActive?: boolean | null;
        }
      );
      if (row) admins.push(row);
    }

    return NextResponse.json({ admins });
  } catch (err) {
    return jsonError(err, "Failed to list admins");
  }
}

export async function POST(request: Request) {
  try {
    await requireFullAdmin();
    const json: unknown = await request.json();
    const parsed = createAdminBodySchema.safeParse(json);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || "Invalid admin details";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const body = parsed.data;
    await connectDB();

    const existing = await User.findOne({ email: body.email }).select("role").lean();
    if (existing) {
      return NextResponse.json(
        { error: emailTakenMessage(existing.role) },
        { status: 409 }
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const now = new Date();

    const user = await User.create({
      email: body.email,
      name: body.name,
      passwordHash,
      role: "admin",
      adminTier: body.adminTier,
      emailVerifiedAt: now,
      emailVerified: true,
      disabledAt: null,
      isActive: true,
      mustChangePassword: true,
      marketingOptIn: false,
    });

    const admin = toAdminTeamMember({
      _id: user._id,
      name: user.name,
      email: user.email,
      adminTier: user.adminTier,
      disabledAt: user.disabledAt,
      isActive: user.isActive,
    });

    return NextResponse.json(
      { admin, temporaryPassword },
      { status: 201 }
    );
  } catch (err) {
    if (isDuplicateKey(err)) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }
    return jsonError(err, "Failed to create admin");
  }
}
