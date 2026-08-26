/**
 * Seed bookings.json into MongoDB (sparkandclean_staging / bookings collection).
 *
 * Usage: npm run seed:bookings
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

const CustomerSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    phone: String,
    email: { type: String, lowercase: true },
  },
  { _id: false }
);

const RugSchema = new mongoose.Schema(
  {
    type: String,
    widthM: Number,
    lengthM: Number,
    areaSqM: Number,
    photos: [String],
    labelPhotos: [String],
  },
  { _id: false }
);

const BookingSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    customer: CustomerSchema,
    suburb: String,
    addressLine1: String,
    city: String,
    coordinates: { lat: Number, lng: Number },
    collectionDate: String,
    collectionSlot: { type: String, enum: ["MORNING", "AFTERNOON"] },
    rug: RugSchema,
    addOns: {
      stainTreatment: Boolean,
      fabricProtection: Boolean,
    },
    estimatedPriceMin: Number,
    estimatedPriceMax: Number,
    couponCode: String,
    status: String,
    paymentStatus: String,
    assignedDriverId: String,
    createdAt: String,
  },
  { collection: "bookings", timestamps: { createdAt: false, updatedAt: true } }
);

const Booking =
  mongoose.models.Booking || mongoose.model("Booking", BookingSchema);

async function seed() {
  const uri = loadMongoUri();
  const dataPath = path.join(__dirname, "..", "src", "data", "bookings.json");
  const bookings = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  console.log(`[seed] Connecting…`);
  await mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 20_000,
  });
  console.log(`[seed] Connected to "${mongoose.connection.name}"`);

  let upserted = 0;
  for (const booking of bookings) {
    await Booking.updateOne({ id: booking.id }, { $set: booking }, { upsert: true });
    upserted += 1;
  }

  const total = await Booking.countDocuments();
  console.log(`[seed] Upserted ${upserted} bookings from bookings.json`);
  console.log(`[seed] Collection "bookings" now has ${total} document(s)`);
  console.log(`[seed] Refresh Compass → database "${mongoose.connection.name}" → bookings`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed] Failed:", err.message || err);
  process.exit(1);
});
