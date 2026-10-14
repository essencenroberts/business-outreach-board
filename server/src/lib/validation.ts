import { z } from "zod";
import { AUDIT_KEYS, AUDIT_VALUES, PRIORITIES, SOURCES } from "./constants.js";

const str = (max = 2000) => z.string().trim().max(max);

export const socialsSchema = z
  .object({
    facebook: str(),
    instagram: str(),
    tiktok: str(),
    linkedin: str(),
    youtube: str(),
    googleBusiness: str(),
    yelp: str(),
  })
  .partial();

export const auditSchema = z.partialRecord(z.enum(AUDIT_KEYS), z.enum(AUDIT_VALUES));

export const businessFields = z.object({
  name: str(200).min(1, "Name is required"),
  category: str(200),
  contactName: str(200),
  phone: str(50),
  email: str(200),
  address: str(500),
  neighborhood: str(200),
  city: str(100),
  state: str(50),
  zip: str(20),
  website: str(),
  socials: socialsSchema,
  status: str(100),
  audit: auditSchema,
  auditSummary: str(20000),
  researchNotes: str(100000),
  pitchSubject: str(300),
  pitchEmail: str(20000),
  services: z.array(str(100)).max(30),
  tags: z.array(str(50)).max(30),
  priority: z.enum(PRIORITIES),
  followUpDate: z.union([z.coerce.date(), z.null()]),
  lastContactedAt: z.union([z.coerce.date(), z.null()]),
  source: z.enum(SOURCES),
});

export const createBusinessSchema = businessFields.partial().required({ name: true });
export const updateBusinessSchema = businessFields.partial();

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;

export const noteSchema = z.object({
  text: str(20000).min(1, "Note text is required"),
  type: z.enum(["note", "email", "call", "meeting"]).default("note"),
});

export const reorderSchema = z.object({
  items: z
    .array(z.object({ id: z.string(), status: str(100), order: z.number() }))
    .max(2000),
});

export const profileSchema = z.object({
  name: str(120),
  businessName: str(160),
  website: str(300),
  phone: str(50),
  email: str(200),
  offer: str(2000),
  bookingLink: str(500),
}).partial();
export type Profile = z.infer<typeof profileSchema>;
