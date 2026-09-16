const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

function loadMongoUri() {
  for (const name of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, "..", name);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^MONGODB_URI=(.*)$/);
      if (match) return match[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("MONGODB_URI not found in .env.local or .env");
}

async function cleanup() {
  await mongoose.connect(loadMongoUri(), {
    bufferCommands: false,
    serverSelectionTimeoutMS: 20_000,
  });

  const users = mongoose.connection.collection("users");
  const drivers = mongoose.connection.collection("drivers");
  const canonicalEmails = [
    "thabo@sparkandclean.co.za",
    "sipho@sparkandclean.co.za",
  ];
  const canonicalDriverIds = ["driver_1", "driver_2"];

  const removedUsers = await users.deleteMany({
    role: "technician",
    email: { $nin: canonicalEmails },
  });
  const removedDrivers = await drivers.deleteMany({
    id: { $nin: canonicalDriverIds },
  });

  console.log(`[cleanup] Removed ${removedUsers.deletedCount} non-canonical technician account(s)`);
  console.log(`[cleanup] Removed ${removedDrivers.deletedCount} non-canonical driver profile(s)`);
  await mongoose.disconnect();
}

cleanup().catch((err) => {
  console.error("[cleanup] Failed:", err.message || err);
  process.exit(1);
});
