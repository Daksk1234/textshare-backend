import { Router } from "express";
import Joi from "joi";
import xss from "xss";
import { authRequired } from "../middleware/auth.js";
import { TextModel } from "../models/Text.js";

const router = Router();
router.use(authRequired);

const schema = Joi.object({
  heading: Joi.string().allow(""),
  text: Joi.string().allow(""),
});

// list newest first
router.get("/", async (req, res) => {
  const items = await TextModel.find({ userId: req.user.id }).sort({
    updatedAt: -1,
  });
  res.json(items);
});

// create
router.post("/", async (req, res) => {
  const { value, error } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const doc = await TextModel.create({
    userId: req.user.id,
    heading: xss(value.heading || ""),
    text: xss(value.text || ""),
  });
  res.json(doc);
});

// update
router.put("/:id", async (req, res) => {
  const { value, error } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const doc = await TextModel.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    {
      $set: { heading: xss(value.heading || ""), text: xss(value.text || "") },
    },
    { new: true }
  );
  if (!doc) return res.status(404).json({ error: "Not found" });
  res.json(doc);
});

// delete
router.delete("/:id", async (req, res) => {
  const r = await TextModel.deleteOne({
    _id: req.params.id,
    userId: req.user.id,
  });
  if (!r.deletedCount) return res.status(404).json({ error: "Not found" });
  res.json({ success: true });
});

export default router;
