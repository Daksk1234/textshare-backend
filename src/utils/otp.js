// otp.js placeholder
import crypto from "crypto";
import bcrypt from "bcryptjs";

export function generateOTP() {
  // 6 digits
  return "" + Math.floor(100000 + Math.random() * 900000);
}

export function hashOTP(otp) {
  const h = bcrypt.hashSync(otp + process.env.OTP_SECRET_SALT, 10);
  return h;
}

export function compareOTP(otp, hashed) {
  return bcrypt.compareSync(otp + process.env.OTP_SECRET_SALT, hashed);
}
