import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { ApiKey } from "../models/ApiKey.js";

export function signToken(email: string) {
  return jwt.sign({ sub: email, role: "admin" }, config.jwtSecret, { expiresIn: "30d" });
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Constant-time comparison of two strings. */
export function safeEqual(a: string, b: string) {
  return crypto.timingSafeEqual(Buffer.from(sha256(a)), Buffer.from(sha256(b)));
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: "Not signed in" });
  }
}

/** Authenticates AI agents using an API key created in Settings. */
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const key =
    (req.headers["x-api-key"] as string | undefined) ??
    (header.startsWith("Bearer ") ? header.slice(7) : "");
  if (!key) {
    res.status(401).json({ error: "Missing API key. Send it as 'Authorization: Bearer <key>'." });
    return;
  }
  const record = await ApiKey.findOneAndUpdate(
    { hash: sha256(key) },
    { lastUsedAt: new Date() },
    { new: true },
  );
  if (!record) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }
  res.locals.agentName = record.name;
  next();
}
