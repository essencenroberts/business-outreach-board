import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config } from "../config.js";
import { HttpError } from "./errors.js";
import { AUDIT_VALUES, SERVICES } from "./constants.js";

let client: Anthropic | null = null;

export function aiEnabled() {
  return Boolean(config.anthropicApiKey);
}

function getClient() {
  if (!aiEnabled()) {
    throw new HttpError(503, "Claude features are off. Add ANTHROPIC_API_KEY to the server's environment.");
  }
  client ??= new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}

// If Claude declines a request for policy reasons, the API retries on a fallback model automatically.
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

function assertNotRefused(message: { stop_reason: string | null }) {
  if (message.stop_reason === "refusal") {
    throw new HttpError(422, "Claude declined this request. Try rephrasing it.");
  }
}

const SYSTEM = `You are the research assistant for a freelance web designer and digital marketer based in St. Louis, Missouri.
They help local small businesses with websites, redesigns, SEO, email capture and lead magnets, customer-journey focused design, and social media and content marketing.
Be factual: only report businesses, URLs, phone numbers and details you actually saw in search results or on fetched pages. If you could not confirm something, say so or leave it blank. Never guess contact details.`;

/** Runs Claude with web search + web fetch and returns its written findings. */
async function research(prompt: string, maxSearches: number, maxFetches: number) {
  const anthropic = getClient();
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
  const texts: string[] = [];

  for (let turn = 0; turn < 6; turn++) {
    const response = await anthropic.beta.messages.create({
      ...FALLBACK,
      model: config.claudeModel,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium" },
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: maxSearches,
          user_location: { type: "approximate", city: "St. Louis", region: "Missouri", country: "US" },
        },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: maxFetches },
      ],
      messages,
    });
    assertNotRefused(response);
    for (const block of response.content) {
      if (block.type === "text") texts.push(block.text);
    }
    if (response.stop_reason !== "pause_turn") break;
    // Long server-side tool runs pause; send the turn back so Claude resumes where it left off.
    messages.push({ role: "assistant", content: response.content });
  }

  const notes = texts.join("").trim();
  if (!notes) throw new HttpError(502, "Claude didn't return any findings. Try again.");
  return notes;
}

/** Turns free text into JSON that matches the schema. */
async function structure<T extends z.ZodType>(schema: T, instructions: string, text: string) {
  const anthropic = getClient();
  const response = await anthropic.beta.messages.parse({
    ...FALLBACK,
    model: config.claudeModel,
    max_tokens: 16000,
    output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    messages: [{ role: "user", content: `${instructions}\n\n<source>\n${text}\n</source>` }],
  });
  assertNotRefused(response);
  if (!response.parsed_output) throw new HttpError(502, "Claude's answer couldn't be read. Try again.");
  return response.parsed_output as z.infer<T>;
}

const auditValue = z.enum(AUDIT_VALUES);
const service = z.enum(SERVICES);

const socialsOut = z.object({
  facebook: z.string(),
  instagram: z.string(),
  tiktok: z.string(),
  linkedin: z.string(),
  youtube: z.string(),
  googleBusiness: z.string(),
  yelp: z.string(),
});

const leadSchema = z.object({
  name: z.string(),
  category: z.string(),
  address: z.string(),
  neighborhood: z.string(),
  zip: z.string(),
  phone: z.string(),
  email: z.string(),
  website: z.string().describe("Their own website URL, or empty string if they have none"),
  hasWebsite: auditValue,
  socials: socialsOut,
  websiteIssues: z.array(z.string()),
  suggestedServices: z.array(service),
  whyGoodLead: z.string(),
});
export type LeadCandidate = z.infer<typeof leadSchema>;

export async function findLeads(opts: { category: string; area: string; count: number; extra?: string; skip: string[] }) {
  const prompt = `Find ${opts.count} ${opts.category} businesses in ${opts.area} (St. Louis, MO area) that look like good prospects for my services.
${opts.extra ? `Extra instructions: ${opts.extra}\n` : ""}
Prioritize independent, locally owned businesses that either:
- have NO website of their own (only Facebook, Instagram, Yelp or a Google listing), or
- have a weak website: not mobile friendly, outdated design, missing SSL, poor SEO (no titles or descriptions), no clear call to action or customer journey, no email signup or lead magnet.

For businesses that have a website, open it with web_fetch and note concrete problems you see.
Skip national chains and franchises.${opts.skip.length ? `\nSkip these businesses that are already on my board: ${opts.skip.join("; ")}.` : ""}

For each business, report: name, category, street address, neighborhood, ZIP, phone, public email if listed, website URL (or that they have none), social/listing URLs (Facebook, Instagram, TikTok, LinkedIn, YouTube, Google Business Profile, Yelp), specific website or marketing issues, which of these services I could pitch (${SERVICES.join(", ")}), and one sentence on why they're a good lead.`;

  const notes = await research(prompt, 10, 12);
  const result = await structure(
    z.object({ leads: z.array(leadSchema) }),
    "Convert this lead research into structured leads. Use only facts in the source. Use empty strings for anything not stated. hasWebsite is 'no' when the business has no website of its own (social pages and directory listings don't count).",
    notes,
  );
  return { leads: result.leads, notes };
}

const auditResultSchema = z.object({
  audit: z.object({
    hasWebsite: auditValue,
    mobileResponsive: auditValue,
    ssl: auditValue,
    seoBasics: auditValue,
    customerJourney: auditValue,
    leadMagnet: auditValue,
    emailCapture: auditValue,
    socialMedia: auditValue,
    contentQuality: auditValue,
    googleProfile: auditValue,
  }),
  summary: z.string().describe("3-5 sentence plain-English assessment"),
  issues: z.array(z.string()),
  suggestedServices: z.array(service),
  pitchAngle: z.string().describe("How to open the conversation with this business"),
  phone: z.string(),
  email: z.string(),
  socials: socialsOut,
});
export type AuditResult = z.infer<typeof auditResultSchema>;

export async function auditBusiness(b: {
  name: string;
  category?: string;
  address?: string;
  neighborhood?: string;
  website?: string;
}) {
  const where = [b.address, b.neighborhood, "St. Louis, MO"].filter(Boolean).join(", ");
  const prompt = `Audit the online presence of this local business so I can decide how to pitch them.

Business: ${b.name}${b.category ? ` (${b.category})` : ""}
Location: ${where}
Website: ${b.website || "none on file. Search to confirm whether they have one."}

Steps:
1. ${b.website ? `Open ${b.website} with web_fetch, plus a contact/about/services page if helpful.` : "Search for their website. If you find one, open it."}
2. Search for their Google Business Profile, Facebook, Instagram, TikTok and Yelp, and judge how active they are.

Evaluate each item and say whether they HAVE it (yes), are MISSING it or it's weak (no), or you couldn't tell (unknown):
- hasWebsite: a working website of their own
- mobileResponsive: the site works well on phones
- ssl: the site uses HTTPS
- seoBasics: good page titles, meta descriptions, headings, local keywords, and is findable on Google
- customerJourney: clear path from landing to action (book, call, buy, quote) with obvious calls to action
- leadMagnet: a free offer to capture leads (guide, coupon, free quote, consult)
- emailCapture: a newsletter or email signup
- socialMedia: active social media with posts in the last month or so
- contentQuality: good photos, copy, and up-to-date information
- googleProfile: a claimed, complete Google Business Profile with reviews

Then summarize the biggest opportunities, list specific issues, recommend services from: ${SERVICES.join(", ")}, and suggest a pitch angle. Include any phone, email and social URLs you found.`;

  const notes = await research(prompt, 5, 6);
  return structure(
    auditResultSchema,
    "Convert this website and marketing audit into the structured format. Use only facts in the source. Use 'unknown' when the source doesn't say, and empty strings for missing contact details.",
    notes,
  );
}

const extractSchema = z.object({
  name: z.string(),
  category: z.string(),
  contactName: z.string(),
  phone: z.string(),
  email: z.string(),
  address: z.string(),
  neighborhood: z.string(),
  zip: z.string(),
  website: z.string(),
  socials: socialsOut,
  hasWebsite: auditValue,
  services: z.array(service),
  researchNotes: z.string().describe("Anything useful in the text that doesn't fit another field"),
});
export type ExtractedBusiness = z.infer<typeof extractSchema>;

export async function extractBusiness(text: string) {
  return structure(
    extractSchema,
    `Extract the local business described below (it's in or near St. Louis, MO). Use only facts in the source and empty strings for anything missing. Social media and directory links go in socials, not website. Set hasWebsite to 'no' only if the source clearly says they have no website. Suggest services only if the source shows a clear need.`,
    text,
  );
}

const PITCH_GUIDE = `Write a short, personal cold email from a St. Louis web designer and digital marketer to a local small business owner.
- 110 to 170 words. Warm, plain, confident. No hype, no jargon, no exclamation-mark spam.
- Open with something specific and genuine about their business (from the notes), not "I hope this finds you well".
- Name 1 to 3 concrete gaps you actually found (e.g. no website, site not mobile friendly, no way to book online, no email list), framed as missed customers, not insults.
- Offer one clear next step: a free 15-minute call or a quick mockup. Include the booking link if provided.
- Sign off with the sender's details. If a detail is missing, leave it out rather than inventing it or using brackets.
- Subject line: under 60 characters, specific to them, not salesy.`;

const pitchSchema = z.object({
  subject: z.string(),
  body: z.string().describe("Plain-text email body with line breaks, including greeting and signature"),
});
export type Pitch = z.infer<typeof pitchSchema>;

export async function draftPitch(
  b: {
    name: string;
    contactName?: string;
    category?: string;
    neighborhood?: string;
    website?: string;
    researchNotes?: string;
    auditSummary?: string;
    services?: string[];
    audit?: Record<string, string>;
  },
  sender: { name: string; businessName: string; website: string; phone: string; email: string; offer: string; bookingLink: string },
  recentNotes: string[],
) {
  const missing = Object.entries(b.audit ?? {})
    .filter(([, v]) => v === "no")
    .map(([k]) => k)
    .join(", ");
  const facts = `Business: ${b.name}${b.category ? ` (${b.category})` : ""}${b.neighborhood ? `, ${b.neighborhood}` : ""}
Owner/contact: ${b.contactName || "unknown"}
Website: ${b.website || "none found"}
Missing (from audit): ${missing || "not audited"}
Services to pitch: ${(b.services ?? []).join(", ") || "not chosen"}

Research notes:
${b.researchNotes || "(none)"}

Audit summary:
${b.auditSummary || "(none)"}

Recent activity:
${recentNotes.join("\n") || "(none)"}

Sender:
Name: ${sender.name || "(not set)"}
Business: ${sender.businessName || "(not set)"}
Website: ${sender.website || "(not set)"}
Phone: ${sender.phone || "(not set)"}
Email: ${sender.email || "(not set)"}
Booking link: ${sender.bookingLink || "(not set)"}
What they offer: ${sender.offer || "(not set)"}`;

  const anthropic = getClient();
  const response = await anthropic.beta.messages.parse({
    ...FALLBACK,
    model: config.claudeModel,
    max_tokens: 4000,
    output_config: { effort: "medium", format: betaZodOutputFormat(pitchSchema) },
    messages: [{ role: "user", content: `${PITCH_GUIDE}\n\nUse only these facts:\n\n<facts>\n${facts}\n</facts>` }],
  });
  assertNotRefused(response);
  if (!response.parsed_output) throw new HttpError(502, "Claude's answer couldn't be read. Try again.");
  return response.parsed_output;
}
