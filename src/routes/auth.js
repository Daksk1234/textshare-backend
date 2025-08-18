// auth routes placeholder
import { Router } from "express";
import Joi from "joi";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/User.js";
import { sendMail } from "../utils/mailer.js";
import { generateOTP, hashOTP, compareOTP } from "../utils/otp.js";

const router = Router();

const regSchema = Joi.object({
  email: Joi.string().email().required(),
  phone: Joi.string().allow(null, ""),
  password: Joi.string().min(8).required(),
});

router.post("/register", async (req, res) => {
  const { value, error } = regSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const exists = await User.findOne({ email: value.email });
  if (exists)
    return res.status(409).json({ error: "Email already registered" });

  const user = new User({
    email: value.email,
    phone: value.phone,
    plan: "free",
  });
  user.setPassword(value.password);
  // create OTP
  const otp = generateOTP();
  user.otp = {
    hash: hashOTP(otp),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  };
  await user.save();

  await sendMail({
    to: user.email,
    subject: "Verify your account",
    html: `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`,
  });

  res.json({ message: "Registered. OTP sent to email." });
});

const otpSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required(),
});

router.post("/verify-otp", async (req, res) => {
  const { value, error } = otpSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const user = await User.findOne({ email: value.email });
  if (!user || !user.otp)
    return res.status(400).json({ error: "Invalid request" });

  if (user.otp.expiresAt < new Date())
    return res.status(400).json({ error: "OTP expired" });
  if (!compareOTP(value.otp, user.otp.hash))
    return res.status(400).json({ error: "Invalid OTP" });

  user.isVerified = true;
  user.otp = undefined;
  await user.save();
  res.json({ message: "Verified successfully" });
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

router.post("/login", async (req, res) => {
  const { value, error } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const user = await User.findOne({ email: value.email });
  if (!user || !user.validatePassword(value.password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (!user.isVerified) {
    return res.status(403).json({ error: "Account not verified" });
  }

  // include role in token payload (helps for master-only checks)
  const payload = { sub: user._id.toString(), role: user.role };
  const access = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "15m",
  });
  const refresh = jwt.sign(
    { sub: user._id.toString() },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: "30d",
    }
  );

  // return role & plan so the client can route masters to the master panel
  res.json({
    access,
    refresh,
    user: {
      _id: user._id,
      email: user.email,
      role: user.role, // "user" | "master"
      plan: user.plan, // "free" | "paid"
    },
  });
});

router.post("/refresh", async (req, res) => {
  const { refresh } = req.body || {};
  if (!refresh) return res.status(400).json({ error: "Missing refresh token" });
  try {
    const decoded = jwt.verify(refresh, process.env.JWT_REFRESH_SECRET);
    const access = jwt.sign(
      { sub: decoded.sub },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );
    res.json({ access });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

// Password reset
router.post("/request-password-reset", async (req, res) => {
  const { email } = req.body || {};
  const user = await User.findOne({ email });
  if (!user)
    return res.json({
      message: "If the account exists, an email has been sent.",
    });

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  user.reset = { tokenHash, expiresAt: new Date(Date.now() + 15 * 60 * 1000) };
  await user.save();
  const link = `${
    process.env.APP_URL
  }/auth/reset?token=${token}&email=${encodeURIComponent(email)}`;

  await sendMail({
    to: email,
    subject: "Password Reset",
    html: `<p>Reset link (15 min): <a href="${link}">${link}</a></p>`,
  });

  res.json({ message: "If the account exists, an email has been sent." });
});

router.post("/reset-password", async (req, res) => {
  const { email, token, newPassword } = req.body || {};
  const user = await User.findOne({ email });
  if (!user || !user.reset)
    return res.status(400).json({ error: "Invalid request" });
  if (user.reset.expiresAt < new Date())
    return res.status(400).json({ error: "Token expired" });

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  if (tokenHash !== user.reset.tokenHash)
    return res.status(400).json({ error: "Invalid token" });

  user.setPassword(newPassword);
  user.reset = undefined;
  await user.save();
  res.json({ message: "Password reset successful" });
});

router.post("/resend-otp", async (req, res) => {
  const { email } = req.body || {};
  const user = await User.findOne({ email });
  if (!user) return res.json({ message: "If registered, OTP sent." });
  const otp = generateOTP();
  user.otp = {
    hash: hashOTP(otp),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  };
  await user.save();
  await sendMail({
    to: email,
    subject: "Your OTP",
    html: `<p>OTP: <b>${otp}</b></p>`,
  });
  res.json({ message: "OTP sent" });
});

export default router;
