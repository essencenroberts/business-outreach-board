import { Router } from "express";
import { z } from "zod";
import { Business } from "../models/Business.js";
import { Activity, logActivity } from "../models/Activity.js";
import { getProfile, getStages } from "../models/Settings.js";
import { createBusiness, findDuplicate, updateBusiness } from "../lib/businessService.js";
import { createBusinessSchema, noteSchema, updateBusinessSchema } from "../lib/validation.js";
import { AUDIT_KEYS, SERVICES } from "../lib/constants.js";
import { HttpError } from "../lib/errors.js";

/**
 * API for AI agents (Claude Code, Claude Desktop, custom agents).
 * Authenticate with an API key from Settings: `Authorization: Bearer bob_...`
 */
const router = Router();

const agentName = (res: { locals: Record<string, unknown> }) => `agent: ${String(res.locals.agentName ?? "AI")}`;

router.get("/", async (_req, res) => {
  res.json({
    description: "Business Outreach Board agent API. Track St. Louis small businesses as sales leads.",
    endpoints: {
      "GET /api/agent/stages": "Pipeline stages. Use a stage id as `status`.",
      "GET /api/agent/leads?q=&status=": "Search leads",
      "GET /api/agent/leads/:id": "One lead with its activity log",
      "POST /api/agent/leads": "Create a lead (or {leads:[...]} for many). Duplicates are skipped.",
      "PATCH /api/agent/leads/:id": "Update fields, e.g. {status:'contacted_email'}",
      "POST /api/agent/leads/:id/notes": "Add a note: {text, type?: note|email|call|meeting}",
      "GET /api/agent/profile": "The user's own details (name, business, website, phone, offer) for signing email pitches",
    },
    pitches:
      "To save an email pitch for a lead, PATCH /api/agent/leads/:id with {pitchSubject, pitchEmail}. Sign it with the profile details.",
    leadFields: {
      name: "required",
      optional: [
        "category", "contactName", "phone", "email", "address", "neighborhood", "city", "state", "zip",
        "website", "socials{facebook,instagram,tiktok,linkedin,youtube,googleBusiness,yelp}", "status",
        "researchNotes", "pitchSubject", "pitchEmail", "services[]", "tags[]", "priority(low|medium|high)", "followUpDate(ISO date)",
        `audit{${AUDIT_KEYS.join(",")}} each yes|no|unknown (yes = they have it, no = missing/opportunity)`,
      ],
      services: SERVICES,
    },
    stages: await getStages(),
  });
});

router.get("/profile", async (_req, res) => {
  res.json(await getProfile());
});

router.get("/stages", async (_req, res) => {
  res.json(await getStages());
});

router.get("/leads", async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (typeof req.query.status === "string") filter.status = req.query.status;
  if (typeof req.query.q === "string" && req.query.q.trim()) filter.$text = { $search: req.query.q.trim() };
  const leads = await Business.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
  res.json(leads);
});

router.get("/leads/:id", async (req, res) => {
  const lead = await Business.findById(req.params.id).lean();
  if (!lead) throw new HttpError(404, "Lead not found");
  const activity = await Activity.find({ business: lead._id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ ...lead, activity });
});

router.post("/leads", async (req, res) => {
  const body = req.body as unknown;
  const many = typeof body === "object" && body !== null && Array.isArray((body as { leads?: unknown }).leads);
  const inputs = many
    ? z.object({ leads: z.array(createBusinessSchema).max(100) }).parse(body).leads
    : [createBusinessSchema.parse(body)];

  const created = [];
  const skipped = [];
  for (const input of inputs) {
    const dup = await findDuplicate(input);
    if (dup) {
      skipped.push({ name: input.name, reason: "already on board", existingId: dup._id });
      continue;
    }
    created.push(await createBusiness({ ...input, source: "agent" }, agentName(res)));
  }
  res.status(created.length ? 201 : 200).json({ created, skipped });
});

router.patch("/leads/:id", async (req, res) => {
  const doc = await Business.findById(req.params.id);
  if (!doc) throw new HttpError(404, "Lead not found");
  const patch = updateBusinessSchema.parse(req.body);
  await updateBusiness(doc, patch, agentName(res));
  if (patch.pitchEmail) await logActivity(doc._id, "note", "Drafted an email pitch (see Email pitch)", agentName(res));
  res.json(doc);
});

router.post("/leads/:id/notes", async (req, res) => {
  const doc = await Business.findById(req.params.id);
  if (!doc) throw new HttpError(404, "Lead not found");
  const { text, type } = noteSchema.parse(req.body);
  const activity = await logActivity(doc._id, type, text, agentName(res));
  res.status(201).json(activity);
});

export default router;
