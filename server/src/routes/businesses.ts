import { Router } from "express";
import { z } from "zod";
import { Business } from "../models/Business.js";
import { Activity, logActivity } from "../models/Activity.js";
import {
  createBusiness,
  findDuplicate,
  logStatusChange,
  updateBusiness,
} from "../lib/businessService.js";
import {
  createBusinessSchema,
  noteSchema,
  reorderSchema,
  updateBusinessSchema,
} from "../lib/validation.js";
import { checkWebsite } from "../lib/siteCheck.js";
import { HttpError } from "../lib/errors.js";

const router = Router();

async function loadBusiness(id: string) {
  const doc = await Business.findById(id);
  if (!doc) throw new HttpError(404, "Business not found");
  return doc;
}

router.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const filter = q ? { $text: { $search: q } } : {};
  const items = await Business.find(filter).sort({ status: 1, order: 1 }).limit(5000).lean();
  res.json(items);
});

router.post("/", async (req, res) => {
  const input = createBusinessSchema.parse(req.body);
  const force = req.query.force === "true";
  if (!force) {
    const dup = await findDuplicate(input);
    if (dup) {
      res.status(409).json({ error: `Looks like "${dup.name}" is already on your board.`, duplicate: dup });
      return;
    }
  }
  const doc = await createBusiness(input);
  res.status(201).json(doc);
});

router.post("/bulk", async (req, res) => {
  const { items } = z.object({ items: z.array(createBusinessSchema).max(100) }).parse(req.body);
  const created = [];
  const skipped: string[] = [];
  for (const item of items) {
    if (await findDuplicate(item)) {
      skipped.push(item.name);
      continue;
    }
    created.push(await createBusiness(item));
  }
  res.status(201).json({ created, skipped });
});

router.post("/reorder", async (req, res) => {
  const { items } = reorderSchema.parse(req.body);
  const existing = await Business.find({ _id: { $in: items.map((i) => i.id) } });
  const byId = new Map(existing.map((d) => [d.id as string, d]));
  for (const item of items) {
    const doc = byId.get(item.id);
    if (!doc) continue;
    const prev = doc.status;
    doc.status = item.status;
    doc.order = item.order;
    await doc.save();
    if (prev !== item.status) await logStatusChange(doc, prev, item.status);
  }
  res.json({ ok: true });
});

router.get("/:id", async (req, res) => {
  const doc = await loadBusiness(req.params.id);
  res.json(doc);
});

router.patch("/:id", async (req, res) => {
  const doc = await loadBusiness(req.params.id);
  const patch = updateBusinessSchema.parse(req.body);
  await updateBusiness(doc, patch);
  res.json(doc);
});

router.delete("/:id", async (req, res) => {
  const doc = await loadBusiness(req.params.id);
  await Activity.deleteMany({ business: doc._id });
  await doc.deleteOne();
  res.json({ ok: true });
});

router.get("/:id/activities", async (req, res) => {
  const items = await Activity.find({ business: req.params.id }).sort({ createdAt: -1 }).limit(500).lean();
  res.json(items);
});

router.post("/:id/activities", async (req, res) => {
  const doc = await loadBusiness(req.params.id);
  const { text, type } = noteSchema.parse(req.body);
  const activity = await logActivity(doc._id, type, text);
  if (type !== "note") {
    doc.lastContactedAt = new Date();
    await doc.save();
  }
  res.status(201).json(activity);
});

router.delete("/:id/activities/:activityId", async (req, res) => {
  await Activity.deleteOne({ _id: req.params.activityId, business: req.params.id });
  res.json({ ok: true });
});

/** Fast, free website check (no AI): SSL, mobile viewport, SEO tags, email capture, socials. */
router.post("/:id/site-check", async (req, res) => {
  const doc = await loadBusiness(req.params.id);
  if (!doc.website) throw new HttpError(400, "Add a website URL first");
  const result = await checkWebsite(doc.website);
  await updateBusiness(doc, { audit: result.audit, socials: result.socials });
  await logActivity(doc._id, "audit", `Quick site check:\n${result.findings.map((f) => `• ${f}`).join("\n")}`);
  res.json({ business: doc, findings: result.findings });
});

export default router;
