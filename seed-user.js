// Run: node seed-user.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import "dotenv/config";

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/secure_tasks";

// Minimal user schema
const userSchema = new mongoose.Schema({
  email: String,
  phone: String,
  passwordHash: String,
  isVerified: Boolean,
});
const User = mongoose.model("User", userSchema);

async function seed() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: "text_share" });
    console.log("Connected to MongoDB");

    const email = "star281015@gmail.com";
    const password = "12345678";

    const existing = await User.findOne({ email });
    if (existing) {
      console.log("User already exists:", existing.email);
      process.exit(0);
    }

    const hash = bcrypt.hashSync(password, 12);
    const user = await User.create({
      email,
      phone: "",
      passwordHash: hash,
      isVerified: true,
    });

    console.log("✅ Seeded user:");
    console.log("Email:", email);
    console.log("Password:", password);
    process.exit(0);
  } catch (err) {
    console.error("Error seeding user:", err);
    process.exit(1);
  }
}

seed();
