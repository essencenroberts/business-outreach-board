import { Business, type BusinessDoc } from "../models/Business.js";
import { logActivity } from "../models/Activity.js";
import { getStages } from "../models/Settings.js";
import type { CreateBusinessInput, UpdateBusinessInput } from "./validation.js";

export function normalizeUrl(url: string | undefined): string {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function domainOf(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

const digits = (s: string | undefined) => (s ?? "").replace(/\D/g, "").slice(-10);
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Finds an existing business that looks like the same one (same site, phone, or name). */
export async function findDuplicate(input: { name?: string; website?: string; phone?: string }) {
  const or: Record<string, unknown>[] = [];
  const domain = input.website ? domainOf(input.website) : "";
  if (domain && !/facebook|instagram|yelp|google|linktr/.test(domain)) {
    or.push({ website: { $regex: escapeRegex(domain), $options: "i" } });
  }
  const phone = digits(input.phone);
  if (phone.length === 10) {
    const loose = phone.split("").join("\\D*");
    or.push({ phone: { $regex: loose } });
  }
  if (input.name) {
    or.push({ name: { $regex: `^${escapeRegex(input.name.trim())}$`, $options: "i" } });
  }
  if (!or.length) return null;
  return Business.findOne({ $or: or });
}

async function resolveStatus(status: string | undefined): Promise<string> {
  const stages = await getStages();
  if (status && stages.some((s) => s.id === status)) return status;
  return stages[0]?.id ?? "researching";
}

async function topOrder(status: string): Promise<number> {
  const first = await Business.findOne({ status }).sort({ order: 1 }).select("order").lean();
  return (first?.order ?? 0) - 1;
}

function applyPatch(doc: BusinessDoc, patch: UpdateBusinessInput) {
  const { audit, socials, followUpDate, lastContactedAt, website, ...rest } = patch;
  doc.set(rest);
  if (website !== undefined) doc.set("website", normalizeUrl(website));
  if (audit) for (const [k, v] of Object.entries(audit)) doc.set(`audit.${k}`, v);
  if (socials) for (const [k, v] of Object.entries(socials)) doc.set(`socials.${k}`, v);
  if (followUpDate !== undefined) doc.set("followUpDate", followUpDate ?? undefined);
  if (lastContactedAt !== undefined) doc.set("lastContactedAt", lastContactedAt ?? undefined);
  if (patch.pitchEmail !== undefined || patch.pitchSubject !== undefined) doc.set("pitchUpdatedAt", new Date());
}

export async function createBusiness(input: CreateBusinessInput, author = "you") {
  const status = await resolveStatus(input.status);
  const doc = new Business({ status, order: await topOrder(status), source: "manual" });
  applyPatch(doc, { ...input, status });
  await doc.save();
  const via = author === "you" ? "" : ` by ${author}`;
  await logActivity(doc._id, "created", `Added to board${via}`, author);
  return doc;
}

export async function updateBusiness(doc: BusinessDoc, patch: UpdateBusinessInput, author = "you") {
  const prevStatus = doc.status;
  if (patch.status !== undefined) patch.status = await resolveStatus(patch.status);
  applyPatch(doc, patch);
  if (patch.status && patch.status !== prevStatus) {
    doc.order = await topOrder(patch.status);
  }
  await doc.save();
  if (patch.status && patch.status !== prevStatus) {
    await logStatusChange(doc, prevStatus, patch.status, author);
  }
  return doc;
}

export async function logStatusChange(doc: BusinessDoc, from: string, to: string, author = "you") {
  const stages = await getStages();
  const label = (id: string) => stages.find((s) => s.id === id)?.label ?? id;
  if (/contacted|emailed|called/i.test(to) || /^contacted_/.test(to)) {
    doc.lastContactedAt = new Date();
    await doc.save();
  }
  await logActivity(doc._id, "status_change", `Moved from ${label(from)} to ${label(to)}`, author, {
    from,
    to,
  });
}
