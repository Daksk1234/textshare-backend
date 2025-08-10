import mongoose from "mongoose";

const textSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    heading: { type: String, default: "" },
    text: { type: String, default: "" },
  },
  { timestamps: true }
);

export const TextModel = mongoose.model("Text", textSchema);
