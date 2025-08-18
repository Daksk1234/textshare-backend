import mongoose from "mongoose";

const AnswerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    value: mongoose.Schema.Types.Mixed, // string | number | string[] | date ISO etc.
  },
  { _id: false }
);

const FormResponseSchema = new mongoose.Schema(
  {
    formId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Form",
      required: true,
      index: true,
    },
    answers: { type: [AnswerSchema], default: [] },
  },
  { timestamps: true }
);

FormResponseSchema.index({ formId: 1, createdAt: -1 });

const FormResponse = mongoose.model("FormResponse", FormResponseSchema);
export default FormResponse;
