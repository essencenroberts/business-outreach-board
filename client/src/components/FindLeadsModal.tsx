import { useEffect, useState, type FormEvent } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { Check, Copy, Globe, GlobeLock, MapPin, Phone, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { ClaudeCodeRequest, useCopyRequest } from "./ClaudeCodeRequest";
import { GroupedPicker } from "./GroupedPicker";
import { AREA_GROUPS, CATEGORY_GROUPS } from "../lib/options";
import type { Business, BusinessInput, LeadCandidate } from "../lib/types";
import { Button, Field, Input, Modal, Select, externalUrl } from "./ui";

type Candidate = LeadCandidate & { selected: boolean };

const FOCUS = {
  both: "have no website of their own (social media or a booking page like StyleSeat, Booksy or Linktree doesn't count) or a weak website (not mobile friendly, poor SEO, no clear way to book or buy, no email signup)",
  none: "have no website of their own (social media or a booking page like StyleSeat, Booksy or Linktree doesn't count)",
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

  const { copied, copyRequest, requestRef } = useCopyRequest(request);

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
          <GroupedPicker
            required
            value={category}
            onChange={setCategory}
            groups={CATEGORY_GROUPS}
            placeholder="Choose a type…"
            otherPlaceholder="e.g. Sneaker cleaners, tattoo artists"
            ariaLabel="Type of business"
          />
        </Field>
        <Field label="Area">
          <GroupedPicker
            required
            value={area}
            onChange={setArea}
            groups={AREA_GROUPS}
            placeholder="Choose an area…"
            otherPlaceholder="e.g. Florissant, Overland, Granite City"
            ariaLabel="Area"
          />
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
        <div className="mt-5">
          <ClaudeCodeRequest
            request={request}
            copied={copied}
            onCopy={copyRequest}
            requestRef={requestRef}
            whatHappens="Claude researches each business and adds them to Researching (a few minutes)."
            onDone={() => {
              onRefresh();
              onClose();
            }}
          />
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
