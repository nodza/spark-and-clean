/**
 * Seed vehicles.json into MongoDB (vehicles collection).
 * Attaches the two demo bakkies to Thabo (driver_1) and Sipho (driver_2).
 * E10 will own the flexible model (pools, history, types).
 *
 * Usage: npm run seed:vehicles
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

function loadMongoUri() {
  for (const name of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, "..", name);
    if (!fs.existsSync(envPath)) continue;
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^MONGODB_URI=(.*)$/);
      if (match) return match[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("MONGODB_URI not found in .env.local or .env");
}

function plateUniqueKey(plate) {
  return String(plate || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()
    .replace(/[\s-]/g, "");
}

const VehicleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    label: { type: String, required: true, trim: true },
    plate: { type: String, required: true, trim: true },
    plateKey: { type: String, required: true, unique: true },
    assignedDriverId: { type: String, default: null, trim: true },
  },
  { collection: "vehicles", timestamps: { createdAt: true, updatedAt: true } }
);

VehicleSchema.index(
  { assignedDriverId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      assignedDriverId: { $type: "string", $gt: "" },
    },
  }
);

const Vehicle =
  mongoose.models.Vehicle || mongoose.model("Vehicle", VehicleSchema);

async function seed() {
  const uri = loadMongoUri();
  const dataPath = path.join(__dirname, "..", "src", "data", "vehicles.json");
  const vehicles = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  console.log(`[seed] Connecting…`);
  await mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 20_000,
  });
  console.log(`[seed] Connected to "${mongoose.connection.name}"`);

  let upserted = 0;
  for (const vehicle of vehicles) {
    const plate = String(vehicle.plate || "").trim();
    await Vehicle.updateOne(
      { id: vehicle.id },
      {
        $set: {
          id: vehicle.id,
          label: vehicle.label,
          plate,
          plateKey: plateUniqueKey(plate),
          assignedDriverId: vehicle.assignedDriverId || null,
        },
      },
      { upsert: true }
    );
    upserted += 1;
  }

  // Backfill plateKey on any older rows missing it
  const missingKey = await Vehicle.find({
    $or: [{ plateKey: { $exists: false } }, { plateKey: null }, { plateKey: "" }],
  }).lean();
  for (const row of missingKey) {
    const key = plateUniqueKey(row.plate);
    if (!key) continue;
    await Vehicle.updateOne({ id: row.id }, { $set: { plateKey: key } });
  }
  if (missingKey.length) {
    console.log(`[seed] Backfilled plateKey on ${missingKey.length} vehicle(s)`);
  }

  const unset = await mongoose.connection.collection("drivers").updateMany(
    { vehicle: { $exists: true } },
    { $unset: { vehicle: "" } }
  );
  if (unset.modifiedCount) {
    console.log(`[seed] Cleared legacy Driver.vehicle on ${unset.modifiedCount} driver(s)`);
  }

  const total = await Vehicle.countDocuments();
  console.log(`[seed] Upserted ${upserted} vehicles from vehicles.json`);
  console.log(`[seed] Collection "vehicles" now has ${total} document(s)`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed] Failed:", err.message || err);
  process.exit(1);
});
