import mongoose from "mongoose";

const SettingsSchema = new mongoose.Schema(
  {
    // singleton doc to store global config
    key: { type: String, unique: true, default: "global" },
    freeLimits: {
      tasks: { type: Number, default: 10 },
      texts: { type: Number, default: 10 },
      docs: { type: Number, default: 5 },
      forms: { type: Number, default: 2 },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Settings", SettingsSchema);
