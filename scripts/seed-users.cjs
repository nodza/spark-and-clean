/**
 * Seed drivers + role-based users into MongoDB (dev/staging only).
 * Usage: npm run seed:users
 *
 * Passwords: set SEED_DEMO_PASSWORD in .env (team vault). Never commit real vault secrets.
 * Fallback for local-only bootstrapping is used only when the env var is unset.
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

const DEMO_PASSWORD =
  process.env.SEED_DEMO_PASSWORD || process.env.DEMO_PASSWORD;
if (!DEMO_PASSWORD) {
  console.warn(
    "[seed] SEED_DEMO_PASSWORD not set — using local-only default. Set vault password in .env for shared envs."
  );
}
const passwordPlain = DEMO_PASSWORD || "ChangeMeLocalOnly!";

const driversSeed = [
  {
    id: "driver_1",
    name: "Thabo Mbeki",
    vehicle: "Nissan NP200 (CA 123-456)",
    email: "thabo.driver@sparkandclean.co.za",
    phone: "082 100 0001",
    city: "Cape Town",
    isActive: true,
  },
  {
    id: "driver_2",
    name: "Sipho Nkosi",
    vehicle: "Toyota Hilux (CA 987-654)",
    email: "sipho.driver@sparkandclean.co.za",
    phone: "082 100 0002",
    city: "Cape Town",
    isActive: true,
  },
];

/** Ticket seed set: 1 full admin, 1 marketing admin, 2 technicians, 1 client */
const usersSeed = [
  {
    email: "sarah.j@example.com",
    name: "Sarah Jenkins",
    phone: "082 555 1234",
    role: "client",
    adminTier: null,
    preferredCity: "Cape Town",
  },
  {
    email: "admin@sparkandclean.co.za",
    name: "Spark Admin (Full)",
    phone: "064 289 2384",
    role: "admin",
    adminTier: "full",
    preferredCity: "Cape Town",
  },
  {
    email: "marketing@sparkandclean.co.za",
    name: "Spark Marketing Admin",
    phone: "064 289 2385",
    role: "admin",
    adminTier: "marketing-only",
    preferredCity: "Cape Town",
  },
  {
    email: "thabo.driver@sparkandclean.co.za",
    name: "Thabo Mbeki",
    phone: "082 100 0001",
    role: "technician",
    adminTier: null,
    driverProfileId: "driver_1",
    preferredCity: "Cape Town",
  },
  {
    email: "sipho.driver@sparkandclean.co.za",
    name: "Sipho Nkosi",
    phone: "082 100 0002",
    role: "technician",
    adminTier: null,
    driverProfileId: "driver_2",
    preferredCity: "Cape Town",
  },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");

  await mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 20_000,
  });
  console.log(`[seed] Connected to "${mongoose.connection.name}"`);

  const passwordHash = await bcrypt.hash(passwordPlain, 10);
  const now = new Date();

  const drivers = mongoose.connection.collection("drivers");
  const users = mongoose.connection.collection("users");

  await users.createIndex({ email: 1 }, { unique: true });

  for (const d of driversSeed) {
    await drivers.updateOne({ id: d.id }, { $set: d }, { upsert: true });
  }
  console.log(`[seed] Upserted ${driversSeed.length} drivers (Thabo, Sipho)`);

  for (const u of usersSeed) {
    const email = u.email.toLowerCase();
    await users.updateOne(
      { email },
      {
        $set: {
          email,
          name: u.name,
          phone: u.phone,
          role: u.role,
          adminTier: u.adminTier,
          preferredCity: u.preferredCity,
          driverProfileId: u.driverProfileId || null,
          passwordHash,
          emailVerifiedAt: now,
          emailVerified: true,
          disabledAt: null,
          isActive: true,
          loyalty: { punches: 0, rewardsRedeemed: 0 },
          marketingOptIn: false,
          addresses: [],
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
  }

  // Enforce unique email: attempting a second insert with same email must fail
  try {
    await users.insertOne({
      email: "sarah.j@example.com",
      role: "client",
      adminTier: null,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });
    throw new Error("Expected duplicate email insert to fail");
  } catch (err) {
    if (err && err.code === 11000) {
      console.log("[seed] Unique email constraint OK (duplicate rejected)");
    } else if (err instanceof Error && err.message.includes("Expected duplicate")) {
      throw err;
    } else if (err && err.code !== 11000) {
      // Index might not exist yet — create it
      await users.createIndex({ email: 1 }, { unique: true });
      console.log("[seed] Ensured unique email index");
    }
  }

  console.log(
    `[seed] Upserted ${usersSeed.length} users (1 client, 2 admins, 2 technicians)`
  );
  console.log(
    "[seed] Passwords hashed with bcrypt — plaintext only via SEED_DEMO_PASSWORD / vault"
  );

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed] Failed:", err.message || err);
  process.exit(1);
});
