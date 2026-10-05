/**
 * Forward deposit webhooks for the account in STRIPE_SECRET_KEY.
 * `stripe listen` without that key follows the CLI login, which can be a
 * different sandbox account than the app. PowerShell also splits an unquoted
 * comma list into separate arguments, so the event names are passed as one.
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const envText = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
const keyLine = envText
  .split(/\r?\n/)
  .find((line) => line.startsWith("STRIPE_SECRET_KEY="));
const apiKey = keyLine ? keyLine.slice("STRIPE_SECRET_KEY=".length).trim() : "";
if (!apiKey) {
  console.error("Missing STRIPE_SECRET_KEY in .env");
  process.exit(1);
}

const child = spawn(
  "stripe",
  [
    "listen",
    "--events",
    "checkout.session.completed,checkout.session.async_payment_succeeded,payment_intent.succeeded",
    "--forward-to",
    "localhost:3000/api/webhooks/stripe",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, STRIPE_API_KEY: apiKey },
    shell: process.platform === "win32",
  }
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
