/**
 * Seed drivers.json into MongoDB (sparkandclean_staging / drivers collection).
 *
 * Usage: npm run seed:drivers
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

function loadMongoUri() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    throw new Error("Missing .env — add MONGODB_URI first.");
  }
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^MONGODB_URI=(.*)$/);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("MONGODB_URI not found in .env");
}

const DriverSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: String,
    phone: String,
    email: String,
    vehicle: String,
    isActive: { type: Boolean, default: true },
    city: String,
  },
  { collection: "drivers", timestamps: { createdAt: true, updatedAt: true } }
);

const Driver =
  mongoose.models.Driver || mongoose.model("Driver", DriverSchema);

async function seed() {
  const uri = loadMongoUri();
  const dataPath = path.join(__dirname, "..", "src", "data", "drivers.json");
  const drivers = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  console.log(`[seed] Connecting…`);
  await mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 20_000,
  });
  console.log(`[seed] Connected to "${mongoose.connection.name}"`);

  let upserted = 0;
  for (const driver of drivers) {
    await Driver.updateOne({ id: driver.id }, { $set: driver }, { upsert: true });
    upserted += 1;
  }

  const total = await Driver.countDocuments();
  console.log(`[seed] Upserted ${upserted} drivers from drivers.json`);
  console.log(`[seed] Collection "drivers" now has ${total} document(s)`);
  console.log(`[seed] Refresh Compass → database "${mongoose.connection.name}" → drivers`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed] Failed:", err.message || err);
  process.exit(1);
});
