// src/routes/suggestions.js
import { Router } from "express";
import Joi from "joi";
import xss from "xss";
import Suggestion from "../models/Suggestion.js";
import { authRequired, masterOnly } from "../middleware/auth.js";

const router = Router();

/* ---------- Helpers ---------- */
function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "";
}

const createSchema = Joi.object({
  name: Joi.string().max(120).allow(""),
  email: Joi.string().email().allow(""),
  subject: Joi.string().max(200).allow(""),
  category: Joi.string()
    .valid("bug", "feature", "idea", "other")
    .default("other"),
  message: Joi.string().min(5).max(5000).required(),
});

/* ---------- Public: Create suggestion ---------- */
router.post("/", async (req, res) => {
  try {
    const { value, error } = createSchema.validate(req.body || {});
    if (error) return res.status(400).json({ error: error.message });

    const doc = await Suggestion.create({
      name: xss(value.name || ""),
      email: xss(value.email || ""),
      subject: xss(value.subject || ""),
      category: value.category || "other",
      message: xss(value.message),

      ip: clientIp(req),
      userAgent: req.headers["user-agent"] || "",
    });

    res
      .status(201)
      .json({ message: "Thanks for your suggestion!", id: doc._id });
  } catch (e) {
    res.status(500).json({ error: "Failed to submit suggestion" });
  }
});

/* ---------- Master: List suggestions (with basic filters/pagination) ---------- */
router.get("/", async (req, res) => {
  try {
    const { page = "1", limit = "20", q = "", category = "" } = req.query || {};

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const filter = {};
    if (category && ["bug", "feature", "idea", "other"].includes(category)) {
      filter.category = category;
    }
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim(), "i");
      filter.$or = [
        { name: rx },
        { email: rx },
        { subject: rx },
        { message: rx },
      ];
    }

    const total = await Suggestion.countDocuments(filter);
    const items = await Suggestion.find(filter)
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean();

    res.json({
      items,
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l) || 1,
    });
  } catch {
    res.status(500).json({ error: "Failed to load suggestions" });
  }
});

/* ---------- Master: Get one ---------- */
router.get("/:id", async (req, res) => {
  try {
    const s = await Suggestion.findById(req.params.id);
    if (!s) return res.status(404).json({ error: "Not found" });
    res.json(s);
  } catch {
    res.status(500).json({ error: "Failed to load suggestion" });
  }
});

/* ---------- Master: Delete ---------- */
router.delete("/:id", async (req, res) => {
  try {
    const r = await Suggestion.deleteOne({ _id: req.params.id });
    if (!r.deletedCount) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete suggestion" });
  }
});

export default router;
