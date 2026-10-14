import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { Settings, getStages } from "../models/Settings.js";
import { Business } from "../models/Business.js";
import { ApiKey } from "../models/ApiKey.js";
import { sha256 } from "../middleware/auth.js";
import { SERVICES } from "../lib/constants.js";
import { HttpError } from "../lib/errors.js";

const router = Router();

router.get("/stages", async (_req, res) => {
  res.json(await getStages());
});

router.put("/stages", async (req, res) => {
  const stages = z
    .array(
      z.object({
        id: z.string().trim().min(1).max(60).regex(/^[a-z0-9_-]+$/i),
        label: z.string().trim().min(1).max(60),
        color: z.string().trim().max(20),
      }),
    )
    .min(1)
    .max(30)
    .parse(req.body);
  if (new Set(stages.map((s) => s.id)).size !== stages.length) {
    throw new HttpError(400, "Stage ids must be unique");
  }
  await Settings.updateOne({ key: "main" }, { stages }, { upsert: true });
  // Cards in a removed stage go to the first stage so nothing disappears.
  await Business.updateMany({ status: { $nin: stages.map((s) => s.id) } }, { status: stages[0].id });
  res.json(stages);
});

router.get("/services", (_req, res) => {
  res.json(SERVICES);
});

router.get("/api-keys", async (_req, res) => {
  const keys = await ApiKey.find().select("-hash").sort({ createdAt: -1 }).lean();
  res.json(keys);
});

router.post("/api-keys", async (req, res) => {
  const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
  const key = `bob_${crypto.randomBytes(24).toString("base64url")}`;
  const doc = await ApiKey.create({ name, prefix: key.slice(0, 10), hash: sha256(key) });
  // The full key is only returned once.
  res.status(201).json({ _id: doc._id, name: doc.name, prefix: doc.prefix, createdAt: doc.createdAt, key });
});

router.delete("/api-keys/:id", async (req, res) => {
  await ApiKey.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
});

export default router;
