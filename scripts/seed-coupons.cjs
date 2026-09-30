/**
 * Seed the demo coupon SPARK10 (10% off) into MongoDB.
 * Not imported by the Next.js app — run with npm run seed:coupons.
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

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["PERCENT", "FIXED_CENTS"],
    },
    value: { type: Number, required: true, min: 1 },
    active: { type: Boolean, required: true, default: true },
    maxRedemptions: { type: Number, default: null },
    redeemedCount: { type: Number, required: true, default: 0, min: 0 },
    validFrom: { type: Date, default: null },
    validTo: { type: Date, default: null },
    city: {
      type: String,
      enum: ["Johannesburg", "Cape Town", null],
      default: null,
    },
  },
  { collection: "coupons", timestamps: true }
);

const Coupon = mongoose.models.Coupon || mongoose.model("Coupon", CouponSchema);

const SPARK10 = {
  code: "SPARK10",
  type: "PERCENT",
  value: 10,
  active: true,
  maxRedemptions: null,
  validFrom: null,
  validTo: null,
  city: null,
};

async function seed() {
  const uri = loadMongoUri();
  console.log("[seed] Connecting…");
  await mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 20_000,
  });
  console.log(`[seed] Connected to "${mongoose.connection.name}"`);

  await Coupon.updateOne(
    { code: SPARK10.code },
    {
      $set: SPARK10,
      $setOnInsert: { redeemedCount: 0 },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  const doc = await Coupon.findOne({ code: "SPARK10" }).lean();
  if (!doc || doc.type !== "PERCENT" || doc.value !== 10) {
    throw new Error("SPARK10 was not stored as a 10% coupon");
  }

  const total = await Coupon.countDocuments();
  console.log("[seed] Upserted SPARK10 (10% off)");
  console.log(`[seed] Collection "coupons" now has ${total} document(s)`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed] Failed:", err.message || err);
  process.exit(1);
});
