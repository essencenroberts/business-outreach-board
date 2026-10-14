export const AUDIT_KEYS = [
  "hasWebsite",
  "mobileResponsive",
  "ssl",
  "seoBasics",
  "customerJourney",
  "leadMagnet",
  "emailCapture",
  "socialMedia",
  "contentQuality",
  "googleProfile",
] as const;
export type AuditKey = (typeof AUDIT_KEYS)[number];

export const AUDIT_VALUES = ["yes", "no", "unknown"] as const;
export type AuditValue = (typeof AUDIT_VALUES)[number];

/** How much each missing item adds to the opportunity score (sums to 100). */
export const AUDIT_WEIGHTS: Record<AuditKey, number> = {
  hasWebsite: 30,
  mobileResponsive: 12,
  ssl: 5,
  seoBasics: 12,
  customerJourney: 10,
  leadMagnet: 8,
  emailCapture: 8,
  socialMedia: 7,
  contentQuality: 4,
  googleProfile: 4,
};

/** Items that are automatically "missing" when the business has no website. */
export const WEBSITE_DEPENDENT: AuditKey[] = [
  "mobileResponsive",
  "ssl",
  "seoBasics",
  "customerJourney",
  "leadMagnet",
  "emailCapture",
  "contentQuality",
];

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

export const SOURCES = ["manual", "ai-find", "ai-extract", "agent"] as const;
export const PRIORITIES = ["low", "medium", "high"] as const;

export interface Stage {
  id: string;
  label: string;
  color: string;
}

export const DEFAULT_STAGES: Stage[] = [
  { id: "researching", label: "Researching", color: "#f472b6" },
  { id: "contacted_email", label: "Emailed", color: "#fb923c" },
  { id: "contacted_phone", label: "Called", color: "#facc15" },
  { id: "no_response", label: "No Response", color: "#cbd5e1" },
  { id: "responded", label: "Responded", color: "#a3e635" },
  { id: "discovery_call", label: "Discovery Call Set", color: "#f9a8d4" },
  { id: "proposal_sent", label: "Proposal Sent", color: "#fdba74" },
  { id: "contract_signed", label: "Contract Signed", color: "#d9f99d" },
  { id: "onboarding", label: "Onboarding", color: "#84cc16" },
  { id: "won", label: "Won", color: "#65a30d" },
  { id: "lost", label: "Lost", color: "#fb7185" },
];
