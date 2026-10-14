import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Bot, Copy, KeyRound, Plus, Sparkles, Trash2 } from "lucide-react";
import { PUBLIC_API_BASE, api } from "../lib/api";
import type { ApiKeyInfo, Stage } from "../lib/types";
import { Button, Field, Input, Spinner, formatDate } from "../components/ui";

function Panel({ title, icon, children, description }: { title: string; icon: ReactNode; description?: string; children: ReactNode }) {
  return (
    <section className="glass rounded-xl p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-2.5">
        <span className="mt-0.5 text-faint [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Couldn't copy. Select the text and copy it manually."),
  );
}

const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "stage";

function StagesEditor() {
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Stage[]>("/settings/stages").then(setStages).catch(() => setStages([]));
  }, []);

  if (!stages) return <Spinner />;

  const update = (i: number, patch: Partial<Stage>) => setStages(stages.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...stages];
    const [item] = next.splice(i, 1);
    next.splice(i + dir, 0, item);
    setStages(next);
  };
  const add = () => {
    let id = "new_stage";
    let n = 2;
    while (stages.some((s) => s.id === id)) id = `new_stage_${n++}`;
    setStages([...stages, { id, label: "New stage", color: "#f9a8d4" }]);
  };

  async function save() {
    if (!stages) return;
    setSaving(true);
    try {
      setStages(await api.put<Stage[]>("/settings/stages", stages));
      toast.success("Pipeline saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-0.5">
      {stages.map((stage, i) => (
        <div key={i} className="group flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-hover">
          <input
            type="color"
            value={stage.color}
            onChange={(e) => update(i, { color: e.target.value })}
            className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0"
            aria-label={`${stage.label} color`}
          />
          <Input
            value={stage.label}
            onChange={(e) => update(i, { label: e.target.value, id: stage.id.startsWith("new_stage") ? slug(e.target.value) : stage.id })}
            aria-label="Stage name"
            className="field-ghost !border-transparent !bg-transparent focus:!bg-white focus:!border-line-strong"
          />
          <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg p-2 hover:bg-hover disabled:opacity-30" aria-label="Move up">
            <ArrowUp className="h-4 w-4" />
          </button>
          <button onClick={() => move(i, 1)} disabled={i === stages.length - 1} className="rounded-lg p-2 hover:bg-hover disabled:opacity-30" aria-label="Move down">
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            onClick={() => setStages(stages.filter((_, j) => j !== i))}
            disabled={stages.length === 1}
            className="rounded-lg p-2 text-muted hover:bg-red-100 hover:text-red-600 disabled:opacity-30"
            aria-label="Remove stage"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <p className="text-xs text-muted">Removing a stage moves its businesses to the first stage.</p>
      <div className="flex justify-between gap-2 pt-1">
        <Button size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Add stage
        </Button>
        <Button size="sm" variant="primary" onClick={save} loading={saving}>
          Save pipeline
        </Button>
      </div>
    </div>
  );
}

function ApiKeys() {
  const [keys, setKeys] = useState<ApiKeyInfo[] | null>(null);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = () => api.get<ApiKeyInfo[]>("/settings/api-keys").then(setKeys).catch(() => setKeys([]));
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setCreating(true);
    try {
      const created = await api.post<ApiKeyInfo>("/settings/api-keys", { name: name || "My AI agent" });
      setNewKey(created.key ?? null);
      setName("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create key");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this key? Any agent using it will stop working.")) return;
    await api.del(`/settings/api-keys/${id}`);
    load();
  }

  const agentPrompt = `You can manage my Business Outreach Board (a CRM for St. Louis small-business leads) over HTTP.
Base URL: ${PUBLIC_API_BASE}/agent
Auth header: Authorization: Bearer ${newKey ?? "<YOUR_API_KEY>"}

Start with GET ${PUBLIC_API_BASE}/agent to see every endpoint, field and pipeline stage.
- Add leads: POST /agent/leads with JSON {name, category, phone, email, address, neighborhood, zip, website, socials:{facebook,instagram,...}, researchNotes, services:[...], audit:{hasWebsite:"no"}}. Send {leads:[...]} to add many. Duplicates are skipped automatically.
- Search: GET /agent/leads?q=bakery
- Update or move a lead: PATCH /agent/leads/:id with e.g. {status:"contacted_email", followUpDate:"2026-10-20"}
- Log a note: POST /agent/leads/:id/notes {text, type:"note"|"email"|"call"|"meeting"}
Only add real businesses you have verified. Leave fields empty rather than guessing.`;

  const curl = `curl -X POST ${PUBLIC_API_BASE}/agent/leads \\
  -H "Authorization: Bearer ${newKey ?? "<YOUR_API_KEY>"}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Example Bakery","category":"Bakery","neighborhood":"Soulard","phone":"314-555-0100","audit":{"hasWebsite":"no"}}'`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Key name" className="flex-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Claude Code, My research agent" />
        </Field>
        <Button variant="primary" onClick={create} loading={creating}>
          <KeyRound className="h-4 w-4" /> Create API key
        </Button>
      </div>

      {newKey && (
        <div className="rounded-lg border border-lime-400 bg-lime-100 p-3">
          <p className="text-sm font-semibold text-lime-800">Copy this key now. You won't be able to see it again.</p>
          <div className="mt-2 flex gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-[rgb(55_53_47/0.04)] px-3 py-2 text-xs">{newKey}</code>
            <Button size="sm" onClick={() => copy(newKey)}>
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </div>
        </div>
      )}

      {keys === null ? (
        <Spinner />
      ) : keys.length > 0 ? (
        <ul className="space-y-2">
          {keys.map((k) => (
            <li key={k._id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-[rgb(55_53_47/0.05)] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{k.name}</p>
                <p className="text-xs text-muted">
                  {k.prefix}… · created {formatDate(k.createdAt)}
                  {k.lastUsedAt ? ` · last used ${formatDate(k.lastUsedAt)}` : " · never used"}
                </p>
              </div>
              <button onClick={() => revoke(k._id)} className="rounded-lg p-2 text-muted hover:bg-red-100 hover:text-red-600" aria-label={`Revoke ${k.name}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No keys yet.</p>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Instructions to paste into your agent</p>
          <Button size="sm" onClick={() => copy(agentPrompt)}>
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
        </div>
        <pre className="thin-scroll max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-[rgb(55_53_47/0.04)] p-3 text-xs text-ink">{agentPrompt}</pre>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Test it with curl</p>
          <Button size="sm" onClick={() => copy(curl)}>
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
        </div>
        <pre className="thin-scroll overflow-auto rounded-lg bg-[rgb(55_53_47/0.04)] p-3 text-xs text-ink">{curl}</pre>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [ai, setAi] = useState<{ enabled: boolean; model: string } | null>(null);
  useEffect(() => {
    api.get<{ enabled: boolean; model: string }>("/ai/status").then(setAi).catch(() => setAi(null));
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-10 sm:pt-12">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-lime-200 via-yellow-100 to-pink-200 text-2xl shadow-sm" aria-hidden>
        ⚙️
      </div>
      <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">Settings</h1>
      <p className="mb-8 mt-1 text-sm text-muted">Your pipeline, Claude connection and AI agent access.</p>
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Pipeline stages" icon={<ArrowDown className="h-5 w-5" />} description="Rename, recolor, reorder or add the columns on your board.">
        <StagesEditor />
      </Panel>
      <div className="space-y-4">
        <Panel title="Claude" icon={<Sparkles className="h-5 w-5" />}>
          {ai === null ? (
            <Spinner />
          ) : ai.enabled ? (
            <p className="text-sm text-ink">
              Connected using <code className="rounded bg-[rgb(55_53_47/0.06)] px-1">{ai.model}</code>. Find leads, AI quick-add and AI audits are on.
            </p>
          ) : (
            <p className="text-sm text-ink">
              Not connected. Create a key at <span className="font-semibold">console.anthropic.com</span>, then add it as{" "}
              <code className="rounded bg-[rgb(55_53_47/0.06)] px-1">ANTHROPIC_API_KEY</code> on your Render API service.
            </p>
          )}
        </Panel>
        <Panel
          title="AI agent access"
          icon={<Bot className="h-5 w-5" />}
          description="Let Claude (or any AI agent) add and update leads on your board through the API."
        >
          <ApiKeys />
        </Panel>
      </div>
    </div>
    </div>
  );
}
