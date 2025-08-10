// db.js placeholder
import mongoose from "mongoose";

export async function connectDB(uri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { dbName: "text_share" });
  console.log("MongoDB connected");
}
