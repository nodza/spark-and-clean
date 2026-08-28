/**
 * Seed drivers + role-based users into MongoDB.
 * Usage: npm run seed:users
 *
 * Demo passwords (all roles): Password123!
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

function loadEnvVar(key) {
  const envPath = path.join(__dirname, "..", ".env");
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith(`${key}=`)) {
      return trimmed.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return null;
}

const DEMO_PASSWORD = "Password123!";

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

const usersSeed = [
  {
    email: "sarah.j@example.com",
    name: "Sarah Jenkins",
    phone: "082 555 1234",
    role: "CUSTOMER",
    preferredCity: "Cape Town",
  },
  {
    email: "mike.ross@example.com",
    name: "Mike Ross",
    phone: "071 222 9876",
    role: "CUSTOMER",
    preferredCity: "Cape Town",
  },
  {
    email: "admin@sparkandclean.co.za",
    name: "Spark Admin",
    phone: "064 289 2384",
    role: "ADMIN",
    preferredCity: "Cape Town",
  },
  {
    email: "thabo.driver@sparkandclean.co.za",
    name: "Thabo Mbeki",
    phone: "082 100 0001",
    role: "DRIVER",
    driverProfileId: "driver_1",
    preferredCity: "Cape Town",
  },
  {
    email: "sipho.driver@sparkandclean.co.za",
    name: "Sipho Nkosi",
    phone: "082 100 0002",
    role: "DRIVER",
    driverProfileId: "driver_2",
    preferredCity: "Cape Town",
  },
];

async function seed() {
  const uri = loadEnvVar("MONGODB_URI");
  if (!uri) throw new Error("Missing MONGODB_URI");

  await mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 20_000,
  });
  console.log(`[seed] Connected to "${mongoose.connection.name}"`);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const drivers = mongoose.connection.collection("drivers");
  const users = mongoose.connection.collection("users");

  for (const d of driversSeed) {
    await drivers.updateOne({ id: d.id }, { $set: d }, { upsert: true });
  }
  console.log(`[seed] Upserted ${driversSeed.length} drivers`);

  for (const u of usersSeed) {
    await users.updateOne(
      { email: u.email.toLowerCase() },
      {
        $set: {
          ...u,
          email: u.email.toLowerCase(),
          passwordHash,
          emailVerified: true,
          isActive: true,
          loyalty: { punches: 0, rewardsRedeemed: 0 },
          marketingOptIn: false,
          addresses: [],
        },
      },
      { upsert: true }
    );
  }

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed] Failed:", err.message || err);
  process.exit(1);
});
