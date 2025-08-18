import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

/** Attaches { id, role, plan } to req.user */
export async function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const id =
      decoded?.sub || decoded?.id || decoded?._id || decoded?.userId || null;

    let role = decoded?.role || null;
    let plan = decoded?.plan || null;

    if ((!role || !plan) && id) {
      const u = await User.findById(id).select("role plan");
      if (u) {
        role = role || u.role || null;
        plan = plan || u.plan || null;
      }
    }

    if (!id) return res.status(401).json({ error: "Unauthorized" });

    req.user = { id, role, plan };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export async function masterOnly(req, res, next) {
  try {
    if (req.user?.role === "master") return next();
    if (req.user?.id) {
      const u = await User.findById(req.user.id).select("role");
      if (u?.role === "master") return next();
    }
    return res.status(403).json({ message: "Master access only" });
  } catch {
    return res.status(403).json({ message: "Master access only" });
  }
}

// Alias so existing imports like { auth } keep working
export const auth = authRequired;
