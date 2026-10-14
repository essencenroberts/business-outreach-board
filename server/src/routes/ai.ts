import { Router } from "express";
import { z } from "zod";
import { Business } from "../models/Business.js";
import { logActivity } from "../models/Activity.js";
import { aiEnabled, auditBusiness, draftPitch, extractBusiness, findLeads } from "../lib/claude.js";
import { Activity } from "../models/Activity.js";
import { getProfile } from "../models/Settings.js";
import { findDuplicate, updateBusiness } from "../lib/businessService.js";
import { HttpError } from "../lib/errors.js";
import { config } from "../config.js";

const router = Router();

router.get("/status", (_req, res) => {
  res.json({ enabled: aiEnabled(), model: config.claudeModel });
});

/** Paste anything about a business; returns a draft for review (not saved). */
router.post("/extract", async (req, res) => {
  const { text } = z.object({ text: z.string().trim().min(3).max(50000) }).parse(req.body);
  const draft = await extractBusiness(text);
  const duplicate = await findDuplicate(draft);
  res.json({ draft, duplicate });
});

/** Claude searches the web for prospects; returns candidates for review (not saved). */
router.post("/find", async (req, res) => {
  const opts = z
    .object({
      category: z.string().trim().min(2).max(100),
      area: z.string().trim().min(2).max(100),
      count: z.number().int().min(1).max(15).default(8),
      extra: z.string().trim().max(1000).optional(),
    })
    .parse(req.body);
  const existing = await Business.find().sort({ createdAt: -1 }).limit(150).select("name").lean();
  const { leads, notes } = await findLeads({ ...opts, skip: existing.map((b) => b.name) });
  const withDupes = await Promise.all(
    leads.map(async (lead) => {
      const dup = await findDuplicate(lead);
      return { ...lead, duplicateOf: dup ? { _id: dup._id, name: dup.name } : null };
    }),
  );
  res.json({ leads: withDupes, notes });
});

/** Claude reviews the business's website and online presence and fills in the audit. */
router.post("/audit/:id", async (req, res) => {
  const doc = await Business.findById(req.params.id);
  if (!doc) throw new HttpError(404, "Business not found");
  const result = await auditBusiness(doc);

  const fill = (current: string | undefined | null, found: string) => (current ? current : found);
  const socials = Object.fromEntries(
    Object.entries(result.socials).map(([k, v]) => [k, fill(doc.socials?.[k as keyof typeof result.socials], v)]),
  );
  const summary = [
    result.summary,
    result.issues.length ? `\nIssues:\n${result.issues.map((i) => `• ${i}`).join("\n")}` : "",
    result.pitchAngle ? `\nPitch angle: ${result.pitchAngle}` : "",
  ].join("\n").trim();

  await updateBusiness(doc, {
    audit: result.audit,
    auditSummary: summary,
    services: [...new Set([...(doc.services ?? []), ...result.suggestedServices])],
    phone: fill(doc.phone, result.phone),
    email: fill(doc.email, result.email),
    socials,
  });
  doc.auditedAt = new Date();
  await doc.save();
  await logActivity(doc._id, "audit", `Claude audit (opportunity score ${doc.opportunityScore}):\n${summary}`, "Claude");
  res.json(doc);
});

/** Claude drafts an email pitch from the business's research, audit and notes, and saves it. */
router.post("/pitch/:id", async (req, res) => {
  const doc = await Business.findById(req.params.id);
  if (!doc) throw new HttpError(404, "Business not found");
  const notes = await Activity.find({ business: doc._id, type: { $in: ["note", "email", "call", "meeting"] } })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  const pitch = await draftPitch(
    {
      name: doc.name,
      contactName: doc.contactName,
      category: doc.category,
      neighborhood: doc.neighborhood,
      website: doc.website,
      researchNotes: doc.researchNotes,
      auditSummary: doc.auditSummary,
      services: doc.services,
      audit: (doc.toObject().audit ?? {}) as Record<string, string>,
    },
    await getProfile(),
    notes.map((n) => `${n.type}: ${n.text}`),
  );
  await updateBusiness(doc, { pitchSubject: pitch.subject, pitchEmail: pitch.body });
  await logActivity(doc._id, "note", "Drafted an email pitch (see Email pitch)", "Claude");
  res.json(doc);
});

export default router;
