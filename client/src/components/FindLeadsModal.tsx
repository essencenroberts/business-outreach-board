import { useEffect, useRef, useState, type FormEvent } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { Check, Copy, Globe, GlobeLock, MapPin, Phone, RefreshCw, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { copyShortcut, copyText, selectContents } from "../lib/clipboard";
import type { Business, BusinessInput, LeadCandidate } from "../lib/types";
import { Button, Field, Input, Modal, Select, externalUrl } from "./ui";

const CATEGORIES = [
  "Restaurants",
  "Food trucks",
  "Bakeries & cafes",
  "Hair salons",
  "Barbershops",
  "Nail salons",
  "Med spas",
  "Boutiques",
  "Auto repair",
  "Contractors & remodelers",
  "Roofers",
  "Landscapers",
  "Cleaning services",
  "HVAC & plumbers",
  "Fitness studios",
  "Daycares",
  "Pet groomers",
  "Photographers",
  "Event venues",
  "Churches & nonprofits",
];

const AREAS = [
  "St. Louis City",
  "Soulard",
  "Cherokee Street",
  "Tower Grove South",
  "The Grove",
  "Central West End",
  "Delmar Loop / University City",
  "Benton Park",
  "Lafayette Square",
  "The Hill",
  "Dogtown",
  "Downtown St. Louis",
  "North St. Louis",
  "North County (Florissant, Ferguson)",
  "South County",
  "Maplewood",
  "Kirkwood",
  "Webster Groves",
  "Clayton",
  "Chesterfield",
  "Ballwin / Manchester",
  "St. Charles",
  "O'Fallon, MO",
  "Belleville, IL",
  "Edwardsville, IL",
];

type Candidate = LeadCandidate & { selected: boolean };

const FOCUS = {
  both: "have no website or a weak website (not mobile friendly, poor SEO, no clear way to book or buy, no email signup)",
  none: "have no website of their own",
  weak: "have a weak website (not mobile friendly, poor SEO, no clear way to book or buy, no email signup)",
} as const;

export function FindLeadsModal({
  open,
  onClose,
  onAdded,
  onRefresh,
  aiEnabled,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (created: Business[]) => void;
  onRefresh: () => void;
  aiEnabled: boolean;
}) {
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("");
  const [count, setCount] = useState(8);
  const [extra, setExtra] = useState("");
  const [focus, setFocus] = useState<keyof typeof FOCUS>("both");
  const [showRequest, setShowRequest] = useState(false);
  const [copied, setCopied] = useState(false);
  const requestRef = useRef<HTMLTextAreaElement>(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [results, setResults] = useState<Candidate[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setResults(null);
    setShowRequest(false);
  }, [open]);

  const typeText = category.trim() ? category.trim().charAt(0).toLowerCase() + category.trim().slice(1) : "[type of business]";
  const request = `Find ${count} ${typeText} in ${area.trim() || "[area]"} (St. Louis, MO) that ${FOCUS[focus]}, and add them to my Business Outreach Board with research notes.${
    extra.trim() ? ` Also: ${extra.trim().replace(/\.$/, "")}.` : ""
  }`;

  useEffect(() => setCopied(false), [request]);

  async function copyRequest() {
    const ok = await copyText(request);
    setCopied(ok);
    if (ok) {
      toast.success("Request copied. Paste it into Claude Code.");
    } else {
      // Clipboard blocked (some browsers and embedded panes): select it so the user can copy by hand.
      setTimeout(() => selectContents(requestRef.current), 0);
      toast.info(`Your browser blocked copying. The request is selected, so press ${copyShortcut} to copy it.`);
    }
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    if (!aiEnabled) {
      setShowRequest(true);
      await copyRequest();
      return;
    }
    setSearching(true);
    setResults(null);
    try {
      const res = await api.post<{ leads: LeadCandidate[] }>("/ai/find", {
        category,
        area,
        count,
        extra: [`Only include businesses that ${FOCUS[focus]}.`, extra.trim()].filter(Boolean).join(" "),
      });
      setResults(res.leads.map((l) => ({ ...l, selected: !l.duplicateOf })));
      if (!res.leads.length) toast.info("Claude didn't find matching businesses. Try a broader area or category.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function addSelected() {
    if (!results) return;
    const chosen = results.filter((r) => r.selected && !r.duplicateOf);
    if (!chosen.length) return;
    setAdding(true);
    try {
      const items: BusinessInput[] = chosen.map((l) => ({
        name: l.name,
        category: l.category,
        address: l.address,
        neighborhood: l.neighborhood,
        zip: l.zip,
        phone: l.phone,
        email: l.email,
        website: l.website,
        socials: l.socials,
        audit: { hasWebsite: l.hasWebsite },
        services: l.suggestedServices,
        researchNotes: [
          l.whyGoodLead && `Why: ${l.whyGoodLead}`,
          l.websiteIssues.length && `Issues found:\n${l.websiteIssues.map((i) => `• ${i}`).join("\n")}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
        source: "ai-find",
      }));
      const res = await api.post<{ created: Business[]; skipped: string[] }>("/businesses/bulk", { items });
      onAdded(res.created);
      toast.success(`Added ${res.created.length} lead${res.created.length === 1 ? "" : "s"} to Researching`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add leads");
    } finally {
      setAdding(false);
    }
  }

  const toggle = (i: number) => setResults((r) => r && r.map((c, j) => (j === i ? { ...c, selected: !c.selected } : c)));
  const selectedCount = results?.filter((r) => r.selected && !r.duplicateOf).length ?? 0;

  return (
    <Modal open={open} onClose={searching ? () => {} : onClose} title={aiEnabled ? "Find leads with Claude" : "Find leads with Claude Code"} wide>
      <form onSubmit={search} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Field label="Type of business">
          <Input list="bob-categories" required value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Barbershops" />
          <datalist id="bob-categories">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Area">
          <Input list="bob-areas" required value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Cherokee Street" />
          <datalist id="bob-areas">
            {AREAS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>
        <Field label="How many">
          <Select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[5, 8, 10, 15].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Look for businesses that…" className="sm:col-span-3">
          <Select value={focus} onChange={(e) => setFocus(e.target.value as keyof typeof FOCUS)}>
            <option value="both">Have no website or a weak one</option>
            <option value="none">Have no website at all</option>
            <option value="weak">Have a weak website</option>
          </Select>
        </Field>
        <Field label="Anything else? (optional)" className="sm:col-span-3">
          <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="e.g. Black-owned, opened in the last 2 years, only ones with no website" />
        </Field>
        <div className="flex items-center justify-between gap-3 sm:col-span-3">
          <p className="text-xs text-muted">
            {aiEnabled
              ? "Claude searches the web live. This usually takes 1–3 minutes and costs a few cents."
              : "Builds a request for Claude Code, which researches and adds the leads using your Claude plan."}
          </p>
          <Button type="submit" variant="primary" loading={searching} className="shrink-0 whitespace-nowrap">
            {aiEnabled ? <Sparkles className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {searching ? "Searching…" : aiEnabled ? "Find leads" : "Create & copy request"}
          </Button>
        </div>
      </form>

      {!aiEnabled && showRequest && (
        <div className="mt-5 rounded-lg border border-line bg-white/80 p-4">
          <p className="text-xs font-medium text-muted">{copied ? "Your request (copied)" : `Your request: click inside, then press ${copyShortcut}`}</p>
          <div className="mt-1.5 flex items-start gap-2 rounded-md bg-pink-50 p-2 text-sm text-ink">
            <textarea
              ref={requestRef}
              readOnly
              value={request}
              rows={3}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Request for Claude Code"
              className="min-w-0 flex-1 resize-none border-0 bg-transparent p-1 text-sm leading-relaxed text-ink focus:outline-none"
            />
            <Button size="sm" onClick={copyRequest}>
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </div>
          <ol className="mt-3 space-y-1.5 text-sm text-muted">
            <li>
              <span className="font-medium text-ink">1.</span> Open Claude Code in your <code className="rounded bg-[rgb(55_53_47/0.06)] px-1 text-xs">business-outreach-board</code> folder.
            </li>
            <li>
              <span className="font-medium text-ink">2.</span> Paste the request and send it. Claude researches each business and adds them to Researching (a few minutes).
            </li>
            <li>
              <span className="font-medium text-ink">3.</span> When Claude says it's done, refresh the board.
            </li>
          </ol>
          <div className="mt-3 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onRefresh();
                onClose();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Claude's done, refresh board
            </Button>
          </div>
        </div>
      )}

      {searching && (
        <div className="mt-6 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-[rgb(55_53_47/0.05)]" />
          ))}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">{results.length} businesses found</p>
            <Button variant="primary" onClick={addSelected} loading={adding} disabled={!selectedCount}>
              Add {selectedCount} to board
            </Button>
          </div>
          <ul className="space-y-2">
            {results.map((lead, i) => {
              const noSite = lead.hasWebsite === "no" || !lead.website;
              return (
                <li key={`${lead.name}-${i}`}>
                  <div
                    className={clsx(
                      "flex gap-3 rounded-lg border p-3 transition",
                      lead.duplicateOf ? "border-line bg-transparent opacity-60" : lead.selected ? "border-pink-200 bg-pink-50/70" : "border-line bg-[rgb(55_53_47/0.05)]",
                    )}
                  >
                    <button
                      onClick={() => toggle(i)}
                      disabled={!!lead.duplicateOf}
                      aria-pressed={lead.selected}
                      aria-label={`Select ${lead.name}`}
                      className={clsx(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                        lead.selected && !lead.duplicateOf ? "border-pink-500 bg-pink-500 text-ink" : "border-line-strong",
                      )}
                    >
                      {lead.selected && !lead.duplicateOf && <Check className="h-3.5 w-3.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">{lead.name}</p>
                        {lead.duplicateOf && <span className="rounded-md bg-[rgb(55_53_47/0.06)] px-1.5 py-0.5 text-[11px]">Already on board</span>}
                        {noSite ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-600">
                            <GlobeLock className="h-3 w-3" /> No website
                          </span>
                        ) : (
                          <a
                            href={externalUrl(lead.website)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-[rgb(55_53_47/0.06)] px-1.5 py-0.5 text-[11px] hover:bg-hover"
                          >
                            <Globe className="h-3 w-3" /> {lead.website.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}
                          </a>
                        )}
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                        {lead.category && <span>{lead.category}</span>}
                        {(lead.address || lead.neighborhood) && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {lead.address || lead.neighborhood}
                          </span>
                        )}
                        {lead.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {lead.phone}
                          </span>
                        )}
                      </p>
                      {lead.whyGoodLead && <p className="mt-2 text-sm text-ink">{lead.whyGoodLead}</p>}
                      {lead.websiteIssues.length > 0 && (
                        <ul className="mt-1.5 list-inside list-disc text-xs text-muted">
                          {lead.websiteIssues.slice(0, 4).map((issue) => (
                            <li key={issue}>{issue}</li>
                          ))}
                        </ul>
                      )}
                      {lead.suggestedServices.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {lead.suggestedServices.map((s) => (
                            <span key={s} className="rounded-full border border-pink-300/70 bg-pink-50/70 px-2 py-0.5 text-[10px] text-pink-700">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}
