import { useCallback, useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import {
  ArrowUpRight,
  AtSign,
  Bot,
  CalendarClock,
  ChevronDown,
  ChevronsRight,
  CircleDot,
  ClipboardCheck,
  Flag,
  Gauge,
  Globe,
  Hash,
  Layers,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Share2,
  Sparkles,
  Store,
  Tags,
  Trash2,
  User,
  Users,
  Zap,
} from "lucide-react";
import { api } from "../lib/api";
import { CATEGORY_GROUPS } from "../lib/options";
import { GroupedPicker } from "./GroupedPicker";
import { EmailPitch } from "./EmailPitch";
import {
  AUDIT_ITEMS,
  SERVICES,
  SOCIAL_FIELDS,
  type Activity,
  type AuditValue,
  type Business,
  type BusinessInput,
  type Stage,
} from "../lib/types";
import { Button, Chip, ScoreBadge, Spinner, Textarea, externalUrl, formatDate, toDateInput } from "./ui";

type Tab = "audit" | "notes";

/** Borderless text that becomes an input on hover/focus and saves on blur. */
function GhostInput({
  value,
  onCommit,
  placeholder = "Empty",
  type = "text",
  className,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <input
      type={type}
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local.trim() !== value.trim() && onCommit(local.trim())}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={clsx("field-ghost h-8 w-full min-w-0 rounded-md px-2 text-sm", className)}
    />
  );
}

function GhostTextarea({ value, onCommit, placeholder, rows = 5 }: { value: string; onCommit: (v: string) => void; placeholder: string; rows?: number }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <textarea
      rows={rows}
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local.trim() !== value.trim() && onCommit(local.trim())}
      className="field-ghost thin-scroll w-full rounded-md px-2 py-1.5 text-sm leading-relaxed"
    />
  );
}

/** One Notion-style property: icon + label on the left, value on the right. */
function Prop({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-start gap-1">
      <div className="flex h-8 w-[120px] shrink-0 items-center gap-2 px-1 text-sm text-muted sm:w-[150px]">
        <span className="text-faint [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1">{children}</div>
    </div>
  );
}

function LinkOut({ href, label }: { href: string; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={label}
      aria-label={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-faint hover:bg-hover hover:text-ink"
    >
      <ArrowUpRight className="h-4 w-4" />
    </a>
  );
}

const ghostSelect = "field-ghost h-8 w-full cursor-pointer rounded-md px-1.5 text-sm";

const auditOptions: { value: AuditValue; label: string; active: string }[] = [
  { value: "yes", label: "Has it", active: "bg-lime-100 text-lime-800 ring-1 ring-lime-300" },
  { value: "no", label: "Missing", active: "bg-pink-100 text-pink-800 ring-1 ring-pink-300" },
  { value: "unknown", label: "Unknown", active: "bg-[rgb(55_53_47/0.08)] text-ink ring-1 ring-line-strong" },
];

const activityIcon: Record<Activity["type"], ReactNode> = {
  note: <MessageSquare className="h-3.5 w-3.5" />,
  status_change: <CircleDot className="h-3.5 w-3.5" />,
  created: <Sparkles className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  call: <Phone className="h-3.5 w-3.5" />,
  meeting: <Users className="h-3.5 w-3.5" />,
  audit: <ClipboardCheck className="h-3.5 w-3.5" />,
};

export function BusinessDrawer({
  business,
  stages,
  aiEnabled,
  onClose,
  onChange,
  onDelete,
  onRefresh,
}: {
  business: Business;
  stages: Stage[];
  aiEnabled: boolean;
  onClose: () => void;
  onChange: (b: Business) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<Tab>("notes");
  const [showSocials, setShowSocials] = useState(false);
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState<"note" | "email" | "call" | "meeting">("note");
  const [busy, setBusy] = useState<"" | "check" | "audit" | "note" | "delete">("");
  const id = business._id;

  const loadActivity = useCallback(() => {
    api.get<Activity[]>(`/businesses/${id}/activities`).then(setActivity).catch(() => setActivity([]));
  }, [id]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(patch: BusinessInput) {
    try {
      const updated = await api.patch<Business>(`/businesses/${id}`, patch);
      onChange(updated);
      if (patch.status) loadActivity();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    }
  }

  async function runSiteCheck() {
    setBusy("check");
    try {
      const res = await api.post<{ business: Business; findings: string[] }>(`/businesses/${id}/site-check`);
      onChange(res.business);
      loadActivity();
      toast.success("Quick site check done. Findings are in the activity log.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Site check failed");
    } finally {
      setBusy("");
    }
  }

  async function runAiAudit() {
    setBusy("audit");
    const t = toast.loading("Claude is reviewing their website and socials… (about 1–2 minutes)");
    try {
      const updated = await api.post<Business>(`/ai/audit/${id}`);
      onChange(updated);
      loadActivity();
      toast.success("Claude audit complete", { id: t });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Audit failed", { id: t });
    } finally {
      setBusy("");
    }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setBusy("note");
    try {
      await api.post(`/businesses/${id}/activities`, { text: noteText, type: noteType });
      setNoteText("");
      loadActivity();
      if (noteType !== "note") onChange({ ...business, lastContactedAt: new Date().toISOString() });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add note");
    } finally {
      setBusy("");
    }
  }

  async function deleteActivity(activityId: string) {
    await api.del(`/businesses/${id}/activities/${activityId}`).catch(() => null);
    loadActivity();
  }

  async function remove() {
    if (!confirm(`Delete ${business.name} and all its notes? This can't be undone.`)) return;
    setBusy("delete");
    try {
      await api.del(`/businesses/${id}`);
      onDelete(id);
      toast.success("Deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
      setBusy("");
    }
  }

  const toggleService = (s: string) =>
    save({ services: business.services.includes(s) ? business.services.filter((x) => x !== s) : [...business.services, s] });

  const checked = AUDIT_ITEMS.filter((i) => business.audit?.[i.key] !== "unknown").length;
  const currentStage = stages.find((s) => s.id === business.status);
  const socialCount = SOCIAL_FIELDS.filter(({ key }) => business.socials?.[key]).length;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgb(15_15_15/0.08)]" onMouseDown={onClose}>
      <aside
        onMouseDown={(e) => e.stopPropagation()}
        aria-label={business.name}
        className="glass thin-scroll flex h-full w-full flex-col overflow-y-auto !rounded-none !border-y-0 !border-r-0 !bg-white/90 sm:max-w-[600px]"
      >
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between gap-2 bg-white/80 px-3 backdrop-blur-xl">
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink" aria-label="Close" title="Close (Esc)">
            <ChevronsRight className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1 text-xs text-faint">
            <span className="hidden sm:inline">Edited {formatDate(business.updatedAt)}</span>
            {business.website && <LinkOut href={externalUrl(business.website)} label="Open website" />}
            <button
              onClick={remove}
              disabled={busy === "delete"}
              className="flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-[#fdebec] hover:text-[#d44c47]"
              aria-label="Delete business"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pb-10 pt-4 sm:px-12">
          {/* Page icon + title */}
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-pink-200 via-orange-100 to-lime-100 text-3xl" aria-hidden>
            🏪
          </div>
          <GhostInput
            value={business.name}
            onCommit={(name) => name && save({ name })}
            placeholder="Untitled"
            className="!h-auto !px-1 py-1 text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]"
          />

          {/* Properties */}
          <div className="mt-4 space-y-px">
            <Prop icon={<CircleDot />} label="Status">
              <select
                value={business.status}
                onChange={(e) => save({ status: e.target.value })}
                className={clsx(ghostSelect, "font-medium")}
                style={currentStage ? { color: "#37352f", background: `${currentStage.color}26` } : undefined}
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Prop>
            <Prop icon={<Flag />} label="Priority">
              <select value={business.priority} onChange={(e) => save({ priority: e.target.value as Business["priority"] })} className={ghostSelect}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Prop>
            <Prop icon={<CalendarClock />} label="Follow up">
              <input
                type="date"
                value={toDateInput(business.followUpDate)}
                onChange={(e) => save({ followUpDate: e.target.value || null })}
                className="field-ghost h-8 w-full rounded-md px-2 text-sm"
              />
            </Prop>
            <Prop icon={<Gauge />} label="Opportunity">
              <span className="flex items-center gap-2 px-2 text-sm">
                <ScoreBadge score={business.opportunityScore} />
                <span className="text-xs text-faint">
                  {checked}/{AUDIT_ITEMS.length} audited
                </span>
              </span>
            </Prop>
            <Prop icon={<Store />} label="Type">
              <GroupedPicker
                ghost
                commit="blur"
                value={business.category}
                onChange={(category) => save({ category })}
                groups={CATEGORY_GROUPS}
                placeholder="Empty"
                otherPlaceholder="Type of business"
                ariaLabel="Type of business"
              />
            </Prop>
            <Prop icon={<User />} label="Contact">
              <GhostInput value={business.contactName} onCommit={(contactName) => save({ contactName })} />
            </Prop>
            <Prop icon={<Phone />} label="Phone">
              <GhostInput type="tel" value={business.phone} onCommit={(phone) => save({ phone })} />
              {business.phone && <LinkOut href={`tel:${business.phone}`} label="Call" />}
            </Prop>
            <Prop icon={<AtSign />} label="Email">
              <GhostInput type="email" value={business.email} onCommit={(email) => save({ email })} />
              {business.email && <LinkOut href={`mailto:${business.email}`} label="Send email" />}
            </Prop>
            <Prop icon={<Globe />} label="Website">
              <GhostInput value={business.website} placeholder="None" onCommit={(website) => save({ website })} />
              {business.website && <LinkOut href={externalUrl(business.website)} label="Open website" />}
            </Prop>
            <Prop icon={<MapPin />} label="Address">
              <GhostInput value={business.address} onCommit={(address) => save({ address })} />
            </Prop>
            <Prop icon={<MapPin />} label="Neighborhood">
              <GhostInput value={business.neighborhood} onCommit={(neighborhood) => save({ neighborhood })} />
              <GhostInput value={business.zip} placeholder="ZIP" onCommit={(zip) => save({ zip })} className="!w-20 shrink-0" />
            </Prop>
            <Prop icon={<Layers />} label="Services">
              <div className="flex flex-wrap gap-1 px-1 py-1">
                {SERVICES.map((s) => (
                  <Chip key={s} active={business.services.includes(s)} onClick={() => toggleService(s)}>
                    {s}
                  </Chip>
                ))}
              </div>
            </Prop>
            <Prop icon={<Tags />} label="Tags">
              <GhostInput
                value={business.tags.join(", ")}
                placeholder="Comma separated"
                onCommit={(v) => save({ tags: v.split(",").map((t) => t.trim()).filter(Boolean) })}
              />
            </Prop>

            <button
              onClick={() => setShowSocials((v) => !v)}
              className="flex h-8 w-full items-center gap-2 rounded-md px-1 text-sm text-muted hover:bg-hover"
              aria-expanded={showSocials}
            >
              <Share2 className="h-4 w-4 text-faint" />
              Social & listings
              <span className="text-xs text-faint">{socialCount ? `${socialCount} linked` : ""}</span>
              <ChevronDown className={clsx("ml-auto h-4 w-4 text-faint transition-transform", showSocials && "rotate-180")} />
            </button>
            {showSocials &&
              SOCIAL_FIELDS.map(({ key, label }) => (
                <Prop key={key} icon={<Hash />} label={label}>
                  <GhostInput value={business.socials?.[key] ?? ""} placeholder="URL" onCommit={(v) => save({ socials: { [key]: v } })} />
                  {business.socials?.[key] && <LinkOut href={externalUrl(business.socials[key])} label={`Open ${label}`} />}
                </Prop>
              ))}
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-4 border-b border-line" role="tablist">
            {(
              [
                ["notes", "Notes & activity"],
                ["audit", "Website audit"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={clsx(
                  "-mb-px border-b-2 pb-2 text-sm transition-colors",
                  tab === key ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "audit" && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={runSiteCheck} loading={busy === "check"} disabled={!business.website || busy !== ""} title={business.website ? "" : "Add a website first"}>
                  <Zap className="h-3.5 w-3.5" /> Quick site check
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={runAiAudit}
                  loading={busy === "audit"}
                  disabled={!aiEnabled || busy !== ""}
                  title={aiEnabled ? "" : "Add ANTHROPIC_API_KEY on the server to enable"}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Audit with Claude
                </Button>
              </div>

              <div className="divide-y divide-line rounded-lg border border-line bg-white/70">
                {AUDIT_ITEMS.map((item) => {
                  const value = business.audit?.[item.key] ?? "unknown";
                  return (
                    <div key={item.key} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted">{item.hint}</p>
                      </div>
                      <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={item.label}>
                        {auditOptions.map((opt) => (
                          <button
                            key={opt.value}
                            role="radio"
                            aria-checked={value === opt.value}
                            onClick={() => save({ audit: { [item.key]: opt.value } })}
                            className={clsx(
                              "rounded-[4px] px-2 py-0.5 text-xs leading-5 transition-colors",
                              value === opt.value ? opt.active : "text-faint hover:bg-hover hover:text-ink",
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <p className="mb-1 px-2 text-xs font-medium text-muted">Audit summary</p>
                <GhostTextarea
                  rows={7}
                  value={business.auditSummary}
                  placeholder="What's missing, what to pitch, how to open the conversation…"
                  onCommit={(auditSummary) => save({ auditSummary })}
                />
                {business.auditedAt && <p className="px-2 text-xs text-faint">Claude audit on {formatDate(business.auditedAt)}</p>}
              </div>
            </div>
          )}

          {tab === "notes" && (
            <div className="mt-4 space-y-5">
              <div>
                <p className="mb-1 px-2 text-xs font-medium text-muted">Research notes</p>
                <GhostTextarea
                  rows={6}
                  value={business.researchNotes}
                  placeholder="Write what you learned: owner, vibe, what customers say, ideas to pitch…"
                  onCommit={(researchNotes) => save({ researchNotes })}
                />
              </div>

              <EmailPitch
                business={business}
                aiEnabled={aiEnabled}
                onSave={save}
                onChange={(b) => {
                  onChange(b);
                  loadActivity();
                }}
                onRefresh={() => {
                  onRefresh();
                  loadActivity();
                }}
              />

              <div className="rounded-lg border border-line bg-white p-2.5 shadow-[0_1px_2px_rgb(15_15_15/0.04)]">
                <Textarea
                  rows={2}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={noteType === "note" ? "Add a note…" : "What happened?"}
                  className="!border-0 !shadow-none !px-1 focus:!shadow-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote();
                  }}
                />
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {(["note", "email", "call", "meeting"] as const).map((t) => (
                      <Chip key={t} active={noteType === t} onClick={() => setNoteType(t)}>
                        {t === "note" ? "Note" : t === "email" ? "Emailed" : t === "call" ? "Called" : "Meeting"}
                      </Chip>
                    ))}
                  </div>
                  <Button size="sm" variant="primary" onClick={addNote} loading={busy === "note"} disabled={!noteText.trim()}>
                    Add
                  </Button>
                </div>
              </div>

              <div>
                {activity === null ? (
                  <Spinner className="h-4 w-4" />
                ) : activity.length === 0 ? (
                  <p className="px-2 text-sm text-faint">No activity yet.</p>
                ) : (
                  <ol className="relative space-y-0.5">
                    {activity.map((a) => (
                      <li key={a._id} className="group flex gap-3 rounded-md px-2 py-2 hover:bg-hover">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgb(55_53_47/0.06)] text-muted">
                          {a.author.startsWith("agent") || a.author === "Claude" ? <Bot className="h-3.5 w-3.5" /> : activityIcon[a.type]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-faint">
                            <span className="font-medium text-muted">{a.author === "you" ? "You" : a.author}</span> · {new Date(a.createdAt).toLocaleString()}
                          </p>
                          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{a.text}</p>
                        </div>
                        {["note", "email", "call", "meeting"].includes(a.type) && (
                          <button
                            onClick={() => deleteActivity(a._id)}
                            className="self-start rounded p-1 text-faint opacity-0 hover:text-[#d44c47] group-hover:opacity-100 focus:opacity-100"
                            aria-label="Delete entry"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}

          <p className="mt-8 text-xs text-faint">
            Added {formatDate(business.createdAt)}
            {business.lastContactedAt && ` · Last contacted ${formatDate(business.lastContactedAt)}`}
          </p>
        </div>
      </aside>
    </div>
  );
}
