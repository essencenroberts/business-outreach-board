import { useEffect, useState, type FormEvent } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { Copy, PenLine, Sparkles } from "lucide-react";
import { ApiError, api } from "../lib/api";
import type { AuditValue, Business, BusinessInput, Socials, Stage } from "../lib/types";
import { Button, Field, Input, Modal, Select, Textarea } from "./ui";
import { ClaudeCodeRequest, useCopyRequest } from "./ClaudeCodeRequest";

interface Draft {
  name: string;
  category: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  neighborhood: string;
  zip: string;
  website: string;
  researchNotes: string;
  status: string;
  hasWebsite: AuditValue;
  socials: Partial<Socials>;
  services: string[];
}

const emptyDraft = (status: string): Draft => ({
  name: "",
  category: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  neighborhood: "",
  zip: "",
  website: "",
  researchNotes: "",
  status,
  hasWebsite: "unknown",
  socials: {},
  services: [],
});

interface ExtractResponse {
  draft: Omit<Draft, "status"> & { socials: Socials };
  duplicate: Business | null;
}

export function AddBusinessModal({
  open,
  onClose,
  stages,
  aiEnabled,
  onCreated,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  stages: Stage[];
  aiEnabled: boolean;
  onCreated: (b: Business) => void;
  onRefresh: () => void;
}) {
  const firstStage = stages[0]?.id ?? "researching";
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [draft, setDraft] = useState<Draft>(emptyDraft(firstStage));
  const [fromAi, setFromAi] = useState(false);
  const [pasted, setPasted] = useState("");
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const request = `Add this business to my Business Outreach Board. Use the details below, look up anything missing (website, phone, address, social links), check their website and fill in the audit, and add research notes.\n\n${pasted.trim()}`;
  const { copied, copyRequest, requestRef } = useCopyRequest(request);

  useEffect(() => {
    if (open) {
      setDraft(emptyDraft(firstStage));
      setPasted("");
      setDuplicate(null);
      setFromAi(false);
      setShowRequest(false);
      setMode("manual");
    }
  }, [open, firstStage]);

  const set = (key: keyof Draft) => (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  async function extract() {
    setLoading(true);
    try {
      const res = await api.post<ExtractResponse>("/ai/extract", { text: pasted });
      setDraft((d) => ({ ...d, ...res.draft, status: d.status }));
      setFromAi(true);
      setDuplicate(res.duplicate ? res.duplicate.name : null);
      setMode("manual");
      toast.success("Claude filled in the form. Review it, then save.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read that");
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: FormEvent, force = false) {
    e.preventDefault();
    setLoading(true);
    const { hasWebsite, ...rest } = draft;
    const body: BusinessInput = {
      ...rest,
      audit: { hasWebsite: hasWebsite !== "unknown" ? hasWebsite : draft.website ? "yes" : "unknown" },
      source: fromAi ? "ai-extract" : "manual",
    };
    try {
      const created = await api.post<Business>(`/businesses${force ? "?force=true" : ""}`, body);
      onCreated(created);
      toast.success(`${created.name} added`);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDuplicate((err.data as { duplicate?: Business })?.duplicate?.name ?? draft.name);
      } else {
        toast.error(err instanceof Error ? err.message : "Couldn't add business");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a business">
      <div className="mb-4 flex gap-1 rounded-lg bg-[rgb(55_53_47/0.05)] p-1">
        {(
          [
            ["manual", "Fill in manually", PenLine],
            ["ai", aiEnabled ? "Paste & let Claude fill it" : "Paste & send to Claude Code", Sparkles],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={clsx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold sm:text-sm",
              mode === key ? "bg-white shadow-sm" : "text-muted hover:bg-hover",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {mode === "ai" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Paste anything about the business: a Google Maps or Yelp listing, their Instagram bio, a URL, or your own rough notes.{" "}
            {aiEnabled
              ? "Claude will pull out the details for you to review."
              : "Claude Code will add it to your board, look up anything missing (website, phone, social links) and run a website audit."}
          </p>
          <Textarea
            rows={7}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={"e.g. Sweet Soulard Bakery, 1912 S 12th St, St. Louis MO 63104 · (314) 555-0142 · only has an Instagram @sweetsoulard, no website…"}
          />
          <div className="flex justify-end">
            {aiEnabled ? (
              <Button variant="primary" onClick={extract} loading={loading} disabled={pasted.trim().length < 3}>
                <Sparkles className="h-4 w-4" /> Extract details
              </Button>
            ) : (
              <Button
                variant="primary"
                className="whitespace-nowrap"
                disabled={pasted.trim().length < 3}
                onClick={() => {
                  setShowRequest(true);
                  copyRequest();
                }}
              >
                <Copy className="h-4 w-4" /> Create & copy request
              </Button>
            )}
          </div>
          {!aiEnabled && showRequest && pasted.trim().length >= 3 && (
            <ClaudeCodeRequest
              request={request}
              copied={copied}
              onCopy={copyRequest}
              requestRef={requestRef}
              whatHappens="Claude adds the business to Researching, fills in what's missing and audits their website (a minute or two)."
              onDone={() => {
                onRefresh();
                onClose();
              }}
            />
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {fromAi && <p className="rounded-md bg-pink-100 px-3 py-2 text-sm text-pink-700">Filled in by Claude. Double-check before saving.</p>}
          <Field label="Business name *">
            <Input required value={draft.name} onChange={set("name")} autoFocus />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category">
              <Input value={draft.category} onChange={set("category")} placeholder="e.g. Hair salon" />
            </Field>
            <Field label="Contact person">
              <Input value={draft.contactName} onChange={set("contactName")} />
            </Field>
            <Field label="Phone">
              <Input type="tel" value={draft.phone} onChange={set("phone")} />
            </Field>
            <Field label="Email">
              <Input type="email" value={draft.email} onChange={set("email")} />
            </Field>
          </div>
          <Field label="Website">
            <Input value={draft.website} onChange={set("website")} placeholder="Leave empty if none" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Has a website?">
              <Select value={draft.hasWebsite} onChange={(e) => setDraft((d) => ({ ...d, hasWebsite: e.target.value as AuditValue }))}>
                <option value="unknown">Not sure yet</option>
                <option value="yes">Yes</option>
                <option value="no">No website</option>
              </Select>
            </Field>
            <Field label="Column">
              <Select value={draft.status} onChange={set("status")}>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Address">
            <Input value={draft.address} onChange={set("address")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Neighborhood">
              <Input value={draft.neighborhood} onChange={set("neighborhood")} placeholder="e.g. Soulard" />
            </Field>
            <Field label="ZIP">
              <Input value={draft.zip} onChange={set("zip")} />
            </Field>
          </div>
          <Field label="Research notes">
            <Textarea rows={3} value={draft.researchNotes} onChange={set("researchNotes")} />
          </Field>

          {duplicate && (
            <div className="rounded-md bg-yellow-100 px-3 py-2 text-sm text-amber-800">
              "{duplicate}" looks like it's already on your board.{" "}
              <button type="button" className="font-semibold underline" onClick={(e) => submit(e, true)}>
                Add anyway
              </button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              Add to board
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
