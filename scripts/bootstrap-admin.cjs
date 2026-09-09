/**
 * SCW-34 — Bootstrap the first full admin when none exists (dev/staging).
 *
 * Usage:
 *   npm run bootstrap:admin
 *
 * Env:
 *   MONGODB_URI              required
 *   SEED_DEMO_PASSWORD       preferred (team vault) — or BOOTSTRAP_ADMIN_PASSWORD
 *   BOOTSTRAP_ADMIN_EMAIL    optional (default admin@sparkandclean.co.za)
 *   BOOTSTRAP_ADMIN_NAME     optional
 *   BOOTSTRAP_ADMIN_PHONE    optional
 *
 * Production: do not use a public form. See docs/bootstrap-admin.md runbook.
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

function loadEnvFile() {
  for (const name of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, "..", name);
    if (!fs.existsSync(envPath)) continue;
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadEnvFile();

const email = (
  process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@sparkandclean.co.za"
)
  .trim()
  .toLowerCase();
const name = process.env.BOOTSTRAP_ADMIN_NAME || "Spark Admin (Full)";
const phone = process.env.BOOTSTRAP_ADMIN_PHONE || "";
const passwordPlain =
  process.env.BOOTSTRAP_ADMIN_PASSWORD ||
  process.env.SEED_DEMO_PASSWORD ||
  process.env.DEMO_PASSWORD;

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");
  if (!passwordPlain) {
    throw new Error(
      "Set BOOTSTRAP_ADMIN_PASSWORD or SEED_DEMO_PASSWORD (team vault). Refusing to invent a production password."
    );
  }

  await mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 20_000,
  });

  const users = mongoose.connection.collection("users");
  await users.createIndex({ email: 1 }, { unique: true });

  const existingFullAdmin = await users.findOne({
    role: { $in: ["admin", "ADMIN"] },
    adminTier: "full",
    $or: [{ disabledAt: null }, { disabledAt: { $exists: false } }],
  });

  if (existingFullAdmin) {
    console.log(
      `[bootstrap:admin] Full admin already exists (${existingFullAdmin.email}). No changes.`
    );
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(passwordPlain, 10);
  const now = new Date();

  const existingByEmail = await users.findOne({ email });
  if (existingByEmail) {
    await users.updateOne(
      { email },
      {
        $set: {
          name,
          phone: phone || existingByEmail.phone || null,
          role: "admin",
          adminTier: "full",
          passwordHash,
          emailVerifiedAt: now,
          emailVerified: true,
          disabledAt: null,
          isActive: true,
          updatedAt: now,
        },
      }
    );
    console.log(
      `[bootstrap:admin] Upgraded existing user ${email} to full admin.`
    );
  } else {
    await users.insertOne({
      email,
      name,
      phone: phone || null,
      role: "admin",
      adminTier: "full",
      passwordHash,
      preferredCity: "Cape Town",
      emailVerifiedAt: now,
      emailVerified: true,
      disabledAt: null,
      isActive: true,
      loyalty: { punches: 0, rewardsRedeemed: 0 },
      marketingOptIn: false,
      addresses: [],
      createdAt: now,
      updatedAt: now,
    });
    console.log(`[bootstrap:admin] Created first full admin: ${email}`);
  }

  console.log(
    "[bootstrap:admin] Done. Sign in at /login (no public admin registration)."
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[bootstrap:admin] Failed:", err.message || err);
  process.exit(1);
});
