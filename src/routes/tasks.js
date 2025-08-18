import { Router } from "express";
import Joi from "joi";
import xss from "xss";
import { Task } from "../models/Task.js";
import { authRequired } from "../middleware/auth.js";
import { emitToUser } from "../realtime.js";
import { enforceFreeLimit } from "../middleware/limits.js"; // ⬅️ NEW

const router = Router();
router.use(authRequired);

const taskSchema = Joi.object({
  title: Joi.string().max(200).required(),
  note: Joi.string().allow(""),
  documents: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        mimeType: Joi.string().required(),
        uri: Joi.string().required(),
      })
    )
    .default([]),
  date: Joi.date().allow(null),
  starred: Joi.boolean().default(false),
});

// helper to count tasks for the current user
async function countTasksForUser(req /*, ownerId not needed here */) {
  return Task.countDocuments({ userId: req.user.id });
}

// Create (enforce free-plan limit)
router.post(
  "/",
  enforceFreeLimit("tasks", async (req, _ownerId) => countTasksForUser(req)), // ⬅️ NEW
  async (req, res) => {
    const { value, error } = taskSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });
    const t = await Task.create({
      userId: req.user.id,
      title: xss(value.title),
      note: xss(value.note || ""),
      documents: value.documents,
      date: value.date || null,
      starred: !!value.starred,
    });
    emitToUser(req.user.id, "create", t);
    res.json(t);
  }
);

// List (date ASC, with starred/rescheduled precedence if you set that sort)
router.get("/", async (req, res) => {
  const { status = "open" } = req.query;
  const items = await Task.find({ userId: req.user.id, status }).sort({
    starred: -1,
    rescheduledAt: -1,
    date: 1,
    createdAt: -1,
  });
  res.json(items);
});

// Update
router.put("/:id", async (req, res) => {
  const { value, error } = taskSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const t = await Task.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    {
      $set: {
        title: xss(value.title),
        note: xss(value.note || ""),
        documents: value.documents,
        date: value.date || null,
        starred: !!value.starred,
      },
    },
    { new: true }
  );
  if (!t) return res.status(404).json({ error: "Not found" });
  emitToUser(req.user.id, "update", t);
  res.json(t);
});

// Complete
router.post("/:id/complete", async (req, res) => {
  const t = await Task.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $set: { status: "completed" } },
    { new: true }
  );
  if (!t) return res.status(404).json({ error: "Not found" });
  emitToUser(req.user.id, "complete", t);
  res.json(t);
});

// Reschedule to open (tomorrow + mark rescheduledAt)
router.post("/:id/reschedule", async (req, res) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const t = await Task.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $set: { status: "open", date: tomorrow, rescheduledAt: new Date() } },
    { new: true }
  );
  if (!t) return res.status(404).json({ error: "Not found" });
  emitToUser(req.user.id, "reschedule", t);
  res.json(t);
});

// Delete
router.delete("/:id", async (req, res) => {
  const r = await Task.deleteOne({ _id: req.params.id, userId: req.user.id });
  if (!r.deletedCount) return res.status(404).json({ error: "Not found" });
  emitToUser(req.user.id, "delete", { _id: req.params.id });
  res.json({ success: true });
});

export default router;
