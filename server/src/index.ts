import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import { config } from "./config.js";
import { requireAdmin, requireApiKey } from "./middleware/auth.js";
import { errorHandler } from "./lib/errors.js";
import authRoutes from "./routes/auth.js";
import businessRoutes from "./routes/businesses.js";
import settingsRoutes from "./routes/settings.js";
import aiRoutes from "./routes/ai.js";
import agentRoutes from "./routes/agent.js";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Agents and server-to-server calls send no Origin header.
      if (!origin || config.clientOrigins.includes(origin)) return callback(null, true);
      callback(null, false);
    },
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 });
});

app.use("/api/auth", authRoutes);
app.use("/api/businesses", requireAdmin, businessRoutes);
app.use("/api/settings", requireAdmin, settingsRoutes);
app.use("/api/ai", requireAdmin, aiRoutes);
app.use("/api/agent", requireApiKey, agentRoutes);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.use(errorHandler);

async function start() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");
  app.listen(config.port, () => {
    console.log(`API listening on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
