import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import http from "http";
import { Server as IOServer } from "socket.io";
import { connectDB } from "./config/db.js";
import { initRealtime } from "./realtime.js";
import { authLimiter, generalLimiter } from "./middleware/rate.js";
import authRoutes from "./routes/auth.js";
import taskRoutes from "./routes/tasks.js";
import textsRoutes from "./routes/texts.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: "*", credentials: false }));
app.use(express.json({ limit: "1mb" }));

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

app.get("/", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4000;
connectDB(process.env.MONGO_URI)
  .then(() => {
    server.listen(port, () => console.log(`API+WS on :${port}`));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
