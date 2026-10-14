export type AuditValue = "yes" | "no" | "unknown";

export const AUDIT_ITEMS = [
  { key: "hasWebsite", label: "Has a website", hint: "A working site of their own (not just Facebook/Yelp)" },
  { key: "mobileResponsive", label: "Mobile responsive", hint: "Looks and works well on phones" },
  { key: "ssl", label: "SSL / HTTPS", hint: "Secure padlock, no 'Not secure' warning" },
  { key: "seoBasics", label: "SEO basics", hint: "Titles, meta descriptions, headings, local keywords" },
  { key: "customerJourney", label: "Customer journey & CTAs", hint: "Clear path to book, call, buy or get a quote" },
  { key: "leadMagnet", label: "Lead magnet", hint: "Free guide, coupon, quote or consult offer" },
  { key: "emailCapture", label: "Email capture", hint: "Newsletter or email signup form" },
  { key: "socialMedia", label: "Active social media", hint: "Posting regularly in the last month" },
  { key: "contentQuality", label: "Content quality", hint: "Good photos, copy and current info" },
  { key: "googleProfile", label: "Google Business Profile", hint: "Claimed, complete, with reviews" },
] as const;

export type AuditKey = (typeof AUDIT_ITEMS)[number]["key"];

export const SERVICES = [
  "Website build",
  "Website redesign",
  "SEO",
  "Email marketing",
  "Lead magnet",
  "Social media",
  "Content creation",
  "Google Business Profile",
  "Branding",
] as const;

export const SOCIAL_FIELDS = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "youtube", label: "YouTube" },
  { key: "googleBusiness", label: "Google Business" },
  { key: "yelp", label: "Yelp" },
] as const;

export type SocialKey = (typeof SOCIAL_FIELDS)[number]["key"];
export type Socials = Record<SocialKey, string>;
export type Priority = "low" | "medium" | "high";

export interface Business {
  _id: string;
  name: string;
  category: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  socials: Socials;
  status: string;
  order: number;
  audit: Record<AuditKey, AuditValue>;
  auditSummary: string;
  auditedAt?: string;
  opportunityScore: number;
  researchNotes: string;
  services: string[];
  tags: string[];
  priority: Priority;
  followUpDate?: string | null;
  lastContactedAt?: string | null;
  source: "manual" | "ai-find" | "ai-extract" | "agent";
  createdAt: string;
  updatedAt: string;
}

export type BusinessInput = Partial<Omit<Business, "audit" | "socials" | "_id" | "createdAt" | "updatedAt">> & {
  audit?: Partial<Record<AuditKey, AuditValue>>;
  socials?: Partial<Socials>;
};

export interface Stage {
  id: string;
  label: string;
  color: string;
}

export interface Activity {
  _id: string;
  business: string;
  type: "note" | "status_change" | "created" | "email" | "call" | "meeting" | "audit";
  text: string;
  author: string;
  createdAt: string;
}

export interface LeadCandidate {
  name: string;
  category: string;
  address: string;
  neighborhood: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
  hasWebsite: AuditValue;
  socials: Socials;
  websiteIssues: string[];
  suggestedServices: string[];
  whyGoodLead: string;
  duplicateOf: { _id: string; name: string } | null;
}

export interface ApiKeyInfo {
  _id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt?: string;
  key?: string;
}
