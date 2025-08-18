// src/middleware/limits.js
import Settings from "../models/Settings.js";
import { User } from "../models/User.js";

const DEFAULT_LIMITS = { tasks: 10, texts: 10, docs: 5, forms: 2 };

function isObjectId(s) {
  return typeof s === "string" && /^[0-9a-fA-F]{24}$/.test(s);
}

/**
 * Enforce free-plan limits for a resource (e.g., "tasks", "texts", "forms").
 * - Determine the user's role/plan from JWT (req.user) or fallback to the ownerId header.
 * - Masters and paid users are not limited.
 * - For free users, compare count (provided by countFn) vs Settings.freeLimits[resource].
 *
 * @param {("tasks"|"texts"|"docs"|"forms")} resource
 * @param {(req: any, ownerId: string) => Promise<number>} countFn  // how many items already created for this owner
 * @returns Express middleware
 */
export function enforceFreeLimit(resource, countFn) {
  return async (req, res, next) => {
    try {
      // Allow masters and paid: no limits
      // req.user is set by your auth middleware (if route is protected)
      if (req.user?.role === "master" || req.user?.plan === "paid")
        return next();

      // Identify ownerId (your app uses x-owner-id to scope forms; extend to tasks/texts if you do)
      let ownerId = req.headers["x-owner-id"];
      if (!isObjectId(ownerId) && isObjectId(req.user?.id)) {
        ownerId = String(req.user.id);
      }
      if (!isObjectId(ownerId)) {
        return res.status(400).json({
          message:
            "Owner (x-owner-id) is required and must be a valid ObjectId.",
        });
      }

      // Resolve plan/role if not authenticated route
      let plan = req.user?.plan || null;
      let role = req.user?.role || null;
      if (!plan || !role) {
        const u = await User.findById(ownerId).select("role plan");
        role = u?.role || "user";
        plan = u?.plan || "free";
      }

      if (role === "master" || plan === "paid") return next();

      // Load limits
      const s = await Settings.findOne({ key: "global" }).lean();
      const limits = s?.freeLimits || DEFAULT_LIMITS;
      const limit = Number(limits?.[resource] ?? 0);

      // If limit is 0, treat as no allowance
      if (!Number.isFinite(limit) || limit <= 0) {
        return res.status(402).json({
          message: `Free plan limit reached for ${resource}.`,
          type: resource,
          limit: 0,
          count: 0,
        });
      }

      // Count existing items for this owner
      const count = await countFn(req, ownerId);

      if (count >= limit) {
        return res.status(402).json({
          message: `Free plan limit reached for ${resource}.`,
          type: resource,
          limit,
          count,
        });
      }

      return next();
    } catch (e) {
      console.warn("enforceFreeLimit error:", e);
      return res.status(500).json({ message: "Limit check failed." });
    }
  };
}
