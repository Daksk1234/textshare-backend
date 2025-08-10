// User.js placeholder
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const otpSchema = new mongoose.Schema(
  {
    hash: String,
    expiresAt: Date,
  },
  { _id: false }
);

const resetSchema = new mongoose.Schema(
  {
    tokenHash: String,
    expiresAt: Date,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, index: true },
    phone: { type: String, default: null },
    passwordHash: String,
    isVerified: { type: Boolean, default: false },
    otp: otpSchema,
    reset: resetSchema,
  },
  { timestamps: true }
);

userSchema.methods.setPassword = function (password) {
  this.passwordHash = bcrypt.hashSync(password, 12);
};
userSchema.methods.validatePassword = function (password) {
  return bcrypt.compareSync(password, this.passwordHash);
};

export const User = mongoose.model("User", userSchema);
