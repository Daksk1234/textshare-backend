import express from "express";
import { auth, masterOnly } from "../middleware/auth.js";
import { User } from "../models/User.js";
import Form from "../models/Form.js";
import FormResponse from "../models/FormReponse.js";
import Settings from "../models/Settings.js";

const router = express.Router();

/** GET /master/summary — mini dashboard */
router.get("/summary", auth, masterOnly, async (_req, res) => {
  try {
    const [totalUsers, totalMasters, totalForms, totalResponses, settings] =
      await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ role: "master" }),
        Form.countDocuments({}),
        FormResponse.countDocuments({}),
        Settings.findOne({ key: "global" }),
      ]);

    res.json({
      totalUsers,
      totalMasters,
      totalForms,
      totalResponses,
      limits: settings?.freeLimits || {
        tasks: 10,
        texts: 10,
        docs: 5,
        forms: 2,
      },
    });
  } catch (e) {
    console.warn(e);
    res.status(500).json({ message: "Failed to load summary." });
  }
});

/** GET /master/limits — current free plan limits */
router.get("/limits", auth, masterOnly, async (_req, res) => {
  try {
    const s = await Settings.findOne({ key: "global" });
    res.json(s?.freeLimits || { tasks: 10, texts: 10, docs: 5, forms: 2 });
  } catch (e) {
    console.warn(e);
    res.status(500).json({ message: "Failed to load limits." });
  }
});

/** PUT /master/limits — update free plan limits */
router.put("/limits", auth, masterOnly, async (req, res) => {
  try {
    const { tasks, texts, docs, forms } = req.body || {};
    const s =
      (await Settings.findOne({ key: "global" })) ||
      new Settings({ key: "global" });

    s.freeLimits = {
      tasks: Number.isFinite(+tasks) ? +tasks : s.freeLimits.tasks,
      texts: Number.isFinite(+texts) ? +texts : s.freeLimits.texts,
      docs: Number.isFinite(+docs) ? +docs : s.freeLimits.docs,
      forms: Number.isFinite(+forms) ? +forms : s.freeLimits.forms,
    };
    await s.save();
    res.json({ ok: true, freeLimits: s.freeLimits });
  } catch (e) {
    console.warn(e);
    res.status(500).json({ message: "Failed to save limits." });
  }
});

export default router;
