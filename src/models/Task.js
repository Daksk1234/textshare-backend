// src/models/Task.js
import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    title: String,
    note: String,
    status: { type: String, enum: ["open", "completed"], default: "open" },
    documents: [{ name: String, mimeType: String, uri: String }],
    date: { type: Date, default: null }, // simple date
    starred: { type: Boolean, default: false },
    rescheduledAt: { type: Date, default: null }, // << NEW
  },
  { timestamps: true }
);

export const Task = mongoose.model("Task", taskSchema);
