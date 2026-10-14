import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.js";
import { requireAdmin, safeEqual, signToken } from "../middleware/auth.js";

const router = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true });

router.post("/login", loginLimiter, (req, res) => {
  const { email, password } = z
    .object({ email: z.string().trim().toLowerCase(), password: z.string() })
    .parse(req.body);
  const ok = safeEqual(email, config.adminEmail) && safeEqual(password, config.adminPassword);
  if (!ok) {
    res.status(401).json({ error: "Wrong email or password" });
    return;
  }
  res.json({ token: signToken(email), email });
});

router.get("/me", requireAdmin, (_req, res) => {
  res.json({ email: config.adminEmail });
});

export default router;
