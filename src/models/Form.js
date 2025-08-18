import mongoose from "mongoose";

const QuestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // stable client id
    type: {
      type: String,
      required: true,
      enum: [
        "short_text",
        "paragraph",
        "multiple_choice",
        "checkboxes",
        "dropdown",
        "date",
        "number",
        "rating",
        "file",
      ],
    },
    label: { type: String, required: true },
    required: { type: Boolean, default: false },
    options: [{ type: String }],
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
  },
  { _id: false }
);

const FormSchema = new mongoose.Schema(
  {
    // REQUIRED ObjectId — enforces per-account scoping
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    thumbnail: { type: String, default: "" }, // local path like "uploads/forms/<file>"
    totalMembers: { type: Number, default: null },
    questions: { type: [QuestionSchema], default: [] },
  },
  { timestamps: true }
);

FormSchema.index({ owner: 1, createdAt: -1 });

const Form = mongoose.model("Form", FormSchema);
export default Form;
