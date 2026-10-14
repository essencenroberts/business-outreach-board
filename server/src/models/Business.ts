import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import {
  AUDIT_KEYS,
  AUDIT_VALUES,
  AUDIT_WEIGHTS,
  PRIORITIES,
  SOURCES,
  WEBSITE_DEPENDENT,
  type AuditKey,
} from "../lib/constants.js";

const auditField = { type: String, enum: [...AUDIT_VALUES], default: "unknown" };
const auditFields = {
  hasWebsite: auditField,
  mobileResponsive: auditField,
  ssl: auditField,
  seoBasics: auditField,
  customerJourney: auditField,
  leadMagnet: auditField,
  emailCapture: auditField,
  socialMedia: auditField,
  contentQuality: auditField,
  googleProfile: auditField,
} satisfies Record<AuditKey, typeof auditField>;

const businessSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "", trim: true },
    contactName: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    neighborhood: { type: String, default: "", trim: true },
    city: { type: String, default: "St. Louis", trim: true },
    state: { type: String, default: "MO", trim: true },
    zip: { type: String, default: "", trim: true },
    website: { type: String, default: "", trim: true },
    socials: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      tiktok: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      youtube: { type: String, default: "" },
      googleBusiness: { type: String, default: "" },
      yelp: { type: String, default: "" },
    },
    status: { type: String, default: "researching", index: true },
    order: { type: Number, default: 0 },
    audit: auditFields,
    auditSummary: { type: String, default: "" },
    auditedAt: { type: Date },
    opportunityScore: { type: Number, default: 0 },
    researchNotes: { type: String, default: "" },
    pitchSubject: { type: String, default: "" },
    pitchEmail: { type: String, default: "" },
    pitchUpdatedAt: { type: Date },
    services: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    priority: { type: String, enum: PRIORITIES, default: "medium" },
    followUpDate: { type: Date },
    lastContactedAt: { type: Date },
    source: { type: String, enum: SOURCES, default: "manual" },
  },
  { timestamps: true },
);

businessSchema.index({ name: "text", category: "text", neighborhood: "text", researchNotes: "text" });

export function computeOpportunityScore(audit: Partial<Record<AuditKey, string>>): number {
  const noSite = audit.hasWebsite === "no";
  let score = 0;
  for (const key of AUDIT_KEYS) {
    const missing = audit[key] === "no" || (noSite && WEBSITE_DEPENDENT.includes(key));
    if (missing) score += AUDIT_WEIGHTS[key];
  }
  return score;
}

businessSchema.pre("save", function () {
  if (this.website && this.audit?.hasWebsite === "unknown") {
    this.audit.hasWebsite = "yes";
  }
  this.opportunityScore = computeOpportunityScore(this.audit ?? {});
});

export type BusinessAttrs = InferSchemaType<typeof businessSchema>;
export type BusinessDoc = HydratedDocument<BusinessAttrs>;
export const Business = model("Business", businessSchema);
