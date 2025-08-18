import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import mongoose from "mongoose";

import { validateResponseAgainstForm } from "../utils/validators.js";
import Form from "../models/Form.js";
import FormResponse from "../models/FormReponse.js";

import { enforceFreeLimit } from "../middleware/limits.js"; // ⬅️ NEW

const router = express.Router();

/* ───────── Storage (multer) ───────── */
const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_DIR, "forms");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]+/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/webp"].includes(
      file.mimetype
    );
    if (!ok) return cb(new Error("Only PNG/JPEG/WEBP allowed"), false);
    cb(null, true);
  },
});

const WEB_APP_URL = (process.env.WEB_APP_URL || "").replace(/\/+$/, "");

function publicUrl(p) {
  if (!p) return "";
  const base = (process.env.APP_URL || "").replace(/\/+$/, "");
  const rel = p.replace(/\\/g, "/");
  return `${base}/${rel}`;
}

/* ───────── Owner helpers (required) ───────── */
function getOwnerIdString(req) {
  // accept either req.user.id or x-owner-id, fall back to _id if present
  return req.user?.id || req.user?._id || req.header("x-owner-id") || null;
}
function requireOwnerObjectId(req, res) {
  const s = getOwnerIdString(req);
  if (!s || !mongoose.Types.ObjectId.isValid(s)) {
    res.status(401).json({
      message: "Owner (x-owner-id) is required and must be a valid ObjectId.",
    });
    return null;
  }
  return new mongoose.Types.ObjectId(s);
}

/* ───────── Limits: count forms for this owner ───────── */
async function countFormsForOwner(_req, ownerId) {
  return Form.countDocuments({ owner: ownerId });
}

/* ───────── Routes ───────── */

// Create form (owner required) + enforce free-plan limit BEFORE saving file
router.post(
  "/",
  enforceFreeLimit("forms", async (req, ownerId) =>
    countFormsForOwner(req, ownerId)
  ), // ⬅️ NEW
  upload.single("thumbnail"),
  async (req, res) => {
    try {
      const owner = requireOwnerObjectId(req, res);
      if (!owner) return;

      const { title, description, totalMembers, questions } = req.body;
      if (!title?.trim())
        return res.status(400).json({ message: "Title is required." });

      let parsedQs = [];
      try {
        parsedQs =
          typeof questions === "string"
            ? JSON.parse(questions)
            : questions || [];
      } catch {
        return res.status(400).json({ message: "Invalid questions JSON." });
      }

      const thumbnail = req.file
        ? path.join(UPLOAD_DIR, "forms", req.file.filename)
        : "";

      const form = await Form.create({
        owner,
        title: title.trim(),
        description: description || "",
        thumbnail,
        totalMembers:
          totalMembers !== "" && totalMembers != null
            ? Number(totalMembers)
            : null,
        questions: parsedQs,
      });

      res.status(201).json({
        form,
        shareUrl: `${(process.env.APP_URL || "").replace(/\/+$/, "")}/forms/${
          form._id
        }/fill`,
        thumbnailUrl: publicUrl(thumbnail),
      });
    } catch (e) {
      console.warn(e);
      res.status(500).json({ message: "Failed to create form." });
    }
  }
);

// List forms (owner required)
router.get("/", async (req, res) => {
  try {
    const owner = requireOwnerObjectId(req, res);
    if (!owner) return;

    const forms = await Form.find({ owner }).sort({ createdAt: -1 });
    res.json(
      forms.map((f) => ({
        ...f.toObject(),
        thumbnailUrl: publicUrl(f.thumbnail),
        shareUrl: `${(process.env.APP_URL || "").replace(/\/+$/, "")}/forms/${
          f._id
        }/fill`,
      }))
    );
  } catch {
    res.status(500).json({ message: "Failed to load forms." });
  }
});

// Get single form (owner required)
router.get("/:id", async (req, res) => {
  try {
    const owner = requireOwnerObjectId(req, res);
    if (!owner) return;

    const form = await Form.findOne({ _id: req.params.id, owner });
    if (!form) return res.status(404).json({ message: "Form not found." });

    res.json({
      ...form.toObject(),
      thumbnailUrl: publicUrl(form.thumbnail),
      shareUrl: `${(process.env.APP_URL || "").replace(/\/+$/, "")}/forms/${
        form._id
      }/fill`,
    });
  } catch {
    res.status(500).json({ message: "Failed to get form." });
  }
});

// Update form (owner required)
router.put("/:id", upload.single("thumbnail"), async (req, res) => {
  try {
    const owner = requireOwnerObjectId(req, res);
    if (!owner) return;

    const form = await Form.findOne({ _id: req.params.id, owner });
    if (!form) return res.status(404).json({ message: "Form not found." });

    const { title, description, totalMembers, questions } = req.body;

    if (title != null) form.title = title;
    if (description != null) form.description = description;
    if (totalMembers === "" || totalMembers == null) form.totalMembers = null;
    else form.totalMembers = Number(totalMembers);

    if (questions != null) {
      try {
        form.questions =
          typeof questions === "string" ? JSON.parse(questions) : questions;
      } catch {
        return res.status(400).json({ message: "Invalid questions JSON." });
      }
    }

    if (req.file) {
      if (form.thumbnail) {
        try {
          fs.unlinkSync(form.thumbnail);
        } catch {}
      }
      form.thumbnail = path.join(UPLOAD_DIR, "forms", req.file.filename);
    }

    await form.save();
    res.json({ ...form.toObject(), thumbnailUrl: publicUrl(form.thumbnail) });
  } catch {
    res.status(500).json({ message: "Failed to update form." });
  }
});

// HARD Delete form (owner required)
router.delete("/:id", async (req, res) => {
  try {
    const owner = requireOwnerObjectId(req, res);
    if (!owner) return;

    const form = await Form.findOne({ _id: req.params.id, owner });
    if (!form) return res.status(404).json({ message: "Form not found." });

    if (form.thumbnail) {
      try {
        fs.unlinkSync(form.thumbnail);
      } catch {}
    }
    await FormResponse.deleteMany({ formId: form._id });
    await Form.deleteOne({ _id: form._id });

    res.json({ message: "Form hard-deleted." });
  } catch {
    res.status(500).json({ message: "Failed to delete form." });
  }
});

// Submit response (PUBLIC)
router.post("/:id/responses", async (req, res) => {
  try {
    const form = await Form.findOne({ _id: req.params.id });
    if (!form) return res.status(404).json({ message: "Form not found." });

    const { answers } = req.body;
    if (!Array.isArray(answers))
      return res.status(400).json({ message: "Answers must be an array." });

    const errors = validateResponseAgainstForm(form, answers);
    if (errors.length)
      return res.status(400).json({ message: "Validation failed", errors });

    const resp = await FormResponse.create({ formId: form._id, answers });
    res.status(201).json({ responseId: resp._id });
  } catch (e) {
    console.warn(e);
    res.status(500).json({ message: "Failed to submit response." });
  }
});

// Results (owner required)
router.get("/:id/results", async (req, res) => {
  try {
    const owner = requireOwnerObjectId(req, res);
    if (!owner) return;

    const form = await Form.findOne({ _id: req.params.id, owner });
    if (!form) return res.status(404).json({ message: "Form not found." });

    const responses = await FormResponse.find({ formId: form._id }).sort({
      createdAt: -1,
    });

    const choiceSummary = {};
    for (const q of form.questions) {
      if (["multiple_choice", "checkboxes", "dropdown"].includes(q.type)) {
        choiceSummary[q.id] = Object.fromEntries(
          (q.options || []).map((o) => [o, 0])
        );
      }
    }
    for (const r of responses) {
      for (const a of r.answers) {
        const q = form.questions.find((x) => x.id === a.questionId);
        if (!q) continue;
        if (q.type === "multiple_choice" || q.type === "dropdown") {
          if (
            choiceSummary[q.id] &&
            a.value &&
            choiceSummary[q.id][a.value] != null
          ) {
            choiceSummary[q.id][a.value] += 1;
          }
        } else if (q.type === "checkboxes" && Array.isArray(a.value)) {
          for (const v of a.value) {
            if (choiceSummary[q.id] && choiceSummary[q.id][v] != null) {
              choiceSummary[q.id][v] += 1;
            }
          }
        }
      }
    }

    const attended = responses.length;
    const totalMembers = form.totalMembers ?? null;
    const absent =
      totalMembers != null ? Math.max(totalMembers - attended, 0) : null;

    res.json({
      form: {
        id: form._id,
        title: form.title,
        description: form.description,
        totalMembers,
        createdAt: form.createdAt,
      },
      stats: { attended, absent },
      choiceSummary,
      responses,
    });
  } catch {
    res.status(500).json({ message: "Failed to load results." });
  }
});

// Export CSV (owner required)
router.get("/:id/export.csv", async (req, res) => {
  try {
    const owner = requireOwnerObjectId(req, res);
    if (!owner) return;

    const form = await Form.findOne({ _id: req.params.id, owner });
    if (!form) return res.status(404).json({ message: "Form not found." });

    const responses = await FormResponse.find({ formId: form._id }).sort({
      createdAt: 1,
    });

    const headers = form.questions.map((q) => q.label);
    const qIds = form.questions.map((q) => q.id);
    const rows = responses.map((r) => {
      const row = {};
      for (let i = 0; i < qIds.length; i++) {
        const qid = qIds[i];
        const q = form.questions[i];
        const a = r.answers.find((x) => x.questionId === qid);
        let val = "";
        if (a) {
          if (Array.isArray(a.value)) val = a.value.join("; ");
          else if (a.value != null) val = String(a.value);
        }
        row[q.label] = val;
      }
      row["Submitted At"] = r.createdAt.toISOString();
      return row;
    });

    const { Parser } = await import("json2csv");
    const parser = new Parser({ fields: [...headers, "Submitted At"] });
    const csv = parser.parse(rows);

    res.header("Content-Type", "text/csv");
    res.attachment(`${form.title.replace(/[^\w.-]+/g, "_")}_responses.csv`);
    return res.send(csv);
  } catch (e) {
    console.warn(e);
    res.status(500).json({ message: "Failed to export CSV." });
  }
});

// Public redirect for QR
router.get("/:id/fill", async (req, res) => {
  const id = req.params.id;
  if (!WEB_APP_URL) return res.status(500).send("WEB_APP_URL not configured");
  return res.redirect(`${WEB_APP_URL}/form/${id}`);
});

// Public form read (no owner required)
router.get("/:id/public", async (req, res) => {
  try {
    const form = await Form.findById(req.params.id);
    if (!form) return res.status(404).json({ message: "Form not found." });
    res.json({
      id: form._id,
      title: form.title,
      description: form.description,
      thumbnailUrl: publicUrl(form.thumbnail),
      totalMembers: form.totalMembers ?? null,
      questions: form.questions,
      createdAt: form.createdAt,
    });
  } catch {
    res.status(500).json({ message: "Failed to load form." });
  }
});

export default router;
