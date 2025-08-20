import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import http from "http";
import { Server as IOServer } from "socket.io";
import path from "path";
import { connectDB } from "./config/db.js";
import { initRealtime } from "./realtime.js";
import { authLimiter, generalLimiter } from "./middleware/rate.js";
import authRoutes from "./routes/auth.js";
import taskRoutes from "./routes/tasks.js";
import textsRoutes from "./routes/texts.js";
import formRoutes from "./routes/forms.js";
import masterRoutes from "./routes/master.js";
import suggestionRoutes from "./routes/suggestions.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: "*", credentials: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true })); // <— added: helps with form/multipart hybrids

// Serve uploaded files (thumbnails, etc.) at /uploads (or your custom UPLOAD_DIR)
const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
app.use(`/${UPLOAD_DIR}`, express.static(path.join(process.cwd(), UPLOAD_DIR)));

// Create HTTP server + Socket.IO
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] },
});

// Initialize realtime (sets up io.on('connection', ...))
initRealtime(io);

app.use("/auth", authLimiter, authRoutes);
app.use("/tasks", generalLimiter, taskRoutes);
app.use("/texts", generalLimiter, textsRoutes);
app.use("/forms", generalLimiter, formRoutes);
app.use("/master", generalLimiter, masterRoutes);
app.use("/suggestions", generalLimiter, suggestionRoutes);

app.get("/", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4000;
connectDB(process.env.MONGO_URI)
  .then(() => {
    server.listen(port, "0.0.0.0", () => console.log(`API+WS on :${port}`));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
