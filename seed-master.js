// scripts/seedMaster.js
import "dotenv/config";
import mongoose from "mongoose";
import crypto from "crypto";
import { User } from "./src/models/User.js";

function parseArgs(argv) {
  const args = { plan: "paid" }; // default plan for master
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    const set = (k, v) => {
      args[k] = v;
    };

    if (a.startsWith("--")) {
      const [k, v] = a.replace(/^--/, "").split("=");
      if (v !== undefined) set(k, v);
      else if (next && !next.startsWith("--")) {
        set(k, next);
        i++;
      } else set(k, "true");
    }
  }
  return args;
}

function randomPassword(len = 12) {
  return crypto
    .randomBytes(len)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, len);
}

function isEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function main() {
  const { email, password, plan = "paid", phone } = parseArgs(process.argv);

  if (!isEmail(email)) {
    console.error(
      "❌ Provide a valid email:  --email admin@example.com  [--password Secret123] [--plan paid|free] [--phone +15551234567]"
    );
    process.exit(1);
  }
  const pwd = password || randomPassword();

  const uri = process.env.MONGO_URI;
  console.log("🔗 Connecting to", uri);
  await mongoose.connect(uri, {});

  // Ensure indexes (optional but nice)
  await User.init();

  let user = await User.findOne({ email });
  if (user) {
    console.log("ℹ️  User exists — promoting/updating to master");
    if (phone) user.phone = phone;
    user.isVerified = true;
    user.role = "master";
    user.plan = plan === "free" ? "free" : "paid";
    if (password) user.setPassword(pwd); // only reset password if you passed one
  } else {
    console.log("➕ Creating new master user");
    user = new User({
      email,
      phone: phone || null,
      isVerified: true,
      role: "master",
      plan: plan === "free" ? "free" : "paid",
    });
    user.setPassword(pwd);
  }

  await user.save();

  console.log("\n✅ Master user ready:");
  console.log("   id:     ", user._id.toString());
  console.log("   email:  ", user.email);
  console.log("   role:   ", user.role);
  console.log("   plan:   ", user.plan);
  if (!password) {
    console.log("   password (generated):", pwd);
  } else {
    console.log("   password: (as provided)");
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Seed failed:", err?.message || err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
