import type { NextFunction, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import mongoose from "mongoose";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const where = first?.path.length ? `${first.path.join(".")}: ` : "";
    res.status(400).json({ error: `${where}${first?.message ?? "Invalid input"}`, issues: err.issues });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (err instanceof Anthropic.AuthenticationError) {
    res.status(502).json({ error: "Claude rejected the ANTHROPIC_API_KEY. Check the key in Render." });
    return;
  }
  if (err instanceof Anthropic.RateLimitError) {
    res.status(429).json({ error: "Claude is rate limiting requests. Try again in a minute." });
    return;
  }
  if (err instanceof Anthropic.APIError) {
    console.error("Claude API error", err.status, err.message);
    res.status(502).json({ error: `Claude API error: ${err.message}` });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
}
