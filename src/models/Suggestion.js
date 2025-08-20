// src/models/Suggestion.js
import mongoose from "mongoose";

const suggestionSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    email: { type: String, default: "", index: true },
    subject: { type: String, default: "" },
    category: {
      type: String,
      enum: ["bug", "feature", "idea", "other"],
      default: "other",
      index: true,
    },
    message: { type: String, required: true },

    // Meta
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

const Suggestion = mongoose.model("Suggestion", suggestionSchema);
export default Suggestion;
