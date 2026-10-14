import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import clsx from "clsx";
import { KanbanSquare, Plus, Search, Sparkles, X } from "lucide-react";
import { api } from "../lib/api";
import { SERVICES, type Business, type Stage } from "../lib/types";
import { Board, buildColumns, type Columns } from "../components/board/Board";
import { BusinessDrawer } from "../components/BusinessDrawer";
import { AddBusinessModal } from "../components/AddBusinessModal";
import { FindLeadsModal } from "../components/FindLeadsModal";
import { Button, Spinner, hasNoWebsite, isDue } from "../components/ui";

type WebsiteFilter = "all" | "none" | "has";

export function BoardPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [columns, setColumns] = useState<Columns>({});
  const [loading, setLoading] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showFind, setShowFind] = useState(false);

  const [query, setQuery] = useState("");
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilter>("all");
  const [serviceFilter, setServiceFilter] = useState("");
  const [dueOnly, setDueOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([api.get<Stage[]>("/settings/stages"), api.get<Business[]>("/businesses")]);
      setStages(s);
      setBusinesses(b);
      setColumns(buildColumns(s, b));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load your board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api
      .get<{ enabled: boolean }>("/ai/status")
      .then((r) => setAiEnabled(r.enabled))
      .catch(() => setAiEnabled(false));
  }, [load]);

  const byId = useMemo(() => new Map(businesses.map((b) => [b._id, b])), [businesses]);

  const visible = useCallback(
    (b: Business) => {
      const q = query.trim().toLowerCase();
      if (q) {
        const hay = [b.name, b.category, b.neighborhood, b.zip, b.address, b.researchNotes, b.tags.join(" ")].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const noSite = hasNoWebsite(b);
      if (websiteFilter === "none" && !noSite) return false;
      if (websiteFilter === "has" && noSite) return false;
      if (serviceFilter && !b.services.includes(serviceFilter)) return false;
      if (dueOnly && !isDue(b.followUpDate)) return false;
      return true;
    },
    [query, websiteFilter, serviceFilter, dueOnly],
  );

  /** Replace or add a business and keep its column placement in sync. */
  const upsert = useCallback((updated: Business) => {
    setBusinesses((prev) => {
      const exists = prev.some((b) => b._id === updated._id);
      return exists ? prev.map((b) => (b._id === updated._id ? updated : b)) : [updated, ...prev];
    });
    setColumns((prev) => {
      const current = Object.keys(prev).find((k) => prev[k].includes(updated._id));
      if (current === updated.status) return prev;
      const next = { ...prev };
      if (current) next[current] = next[current].filter((id) => id !== updated._id);
      if (next[updated.status]) next[updated.status] = [updated._id, ...next[updated.status]];
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setOpenId(null);
    setBusinesses((prev) => prev.filter((b) => b._id !== id));
    setColumns((prev) => Object.fromEntries(Object.entries(prev).map(([k, ids]) => [k, ids.filter((x) => x !== id)])));
  }, []);

  const persist = useCallback(
    async (changed: { id: string; status: string; order: number }[]) => {
      const lookup = new Map(changed.map((c) => [c.id, c]));
      setBusinesses((prev) => prev.map((b) => (lookup.has(b._id) ? { ...b, ...lookup.get(b._id)!, _id: b._id } : b)));
      try {
        await api.post("/businesses/reorder", { items: changed });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save the move");
        load();
      }
    },
    [load],
  );

  const stats = useMemo(() => {
    const noSite = businesses.filter(hasNoWebsite).length;
    const due = businesses.filter((b) => isDue(b.followUpDate)).length;
    const wonIds = new Set(stages.filter((s) => /won|signed|onboard/i.test(s.id + s.label)).map((s) => s.id));
    const won = businesses.filter((b) => wonIds.has(b.status)).length;
    return { total: businesses.length, noSite, due, won };
  }, [businesses, stages]);

  const openBusiness = openId ? byId.get(openId) : undefined;
  const filtersOn = query || websiteFilter !== "all" || serviceFilter || dueOnly;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const ghostSelect =
    "h-7 cursor-pointer rounded-md border-0 bg-transparent px-2 text-sm text-muted hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Page header, Notion style */}
      <div className="px-4 pt-8 sm:px-10 sm:pt-12">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-300 via-orange-200 to-lime-200 text-2xl shadow-sm" aria-hidden>
          📍
        </div>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">St. Louis Outreach</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Local businesses that need a website, SEO, email capture, or help with social media and content.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
          <Stat label="leads" value={stats.total} />
          <Dot />
          <Stat label="no website" value={stats.noSite} tone="rose" onClick={() => setWebsiteFilter((f) => (f === "none" ? "all" : "none"))} active={websiteFilter === "none"} />
          <Dot />
          <Stat label={stats.due === 1 ? "follow-up due" : "follow-ups due"} value={stats.due} tone="yellow" onClick={() => setDueOnly((v) => !v)} active={dueOnly} />
          <Dot />
          <Stat label="signed" value={stats.won} tone="lime" />
        </div>
      </div>

      {/* View bar */}
      <div className="mt-5 flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-line px-4 pb-1.5 sm:px-10">
        <span className="order-1 -mb-[8px] mr-2 flex h-7 items-center gap-1.5 border-b-2 border-ink px-0.5 pb-1.5 text-sm font-medium">
          <KanbanSquare className="h-4 w-4" /> Board
        </span>
        <div className="order-3 -mx-1 flex w-full items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:order-2 sm:mx-0 sm:ml-auto sm:w-auto">
          <div className="relative flex shrink-0 items-center">
            <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search"
              className="h-7 w-28 rounded-md bg-transparent pl-7 pr-2 text-sm transition-[width] placeholder:text-faint hover:bg-hover focus:w-44 focus:bg-white focus:shadow-[0_0_0_1px_var(--color-line-strong)] focus:outline-none sm:w-36 sm:focus:w-48"
            />
          </div>
          <select value={websiteFilter} onChange={(e) => setWebsiteFilter(e.target.value as WebsiteFilter)} className={clsx(ghostSelect, "shrink-0", websiteFilter !== "all" && "!text-accent")} aria-label="Website filter">
            <option value="all">Website: any</option>
            <option value="none">No website</option>
            <option value="has">Has website</option>
          </select>
          <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className={clsx(ghostSelect, "max-w-40 shrink-0", serviceFilter && "!text-accent")} aria-label="Service filter">
            <option value="">Service: any</option>
            {SERVICES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {filtersOn && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setQuery("");
                setWebsiteFilter("all");
                setServiceFilter("");
                setDueOnly(false);
              }}
            >
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
        <div className="order-2 ml-auto flex items-center gap-1 sm:order-3 sm:ml-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFind(true)}
            title={aiEnabled ? "Let Claude search the web for prospects" : "Build a lead request for Claude Code"}
          >
            <Sparkles className="h-3.5 w-3.5" /> Find leads
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        </div>
      </div>

      {businesses.length === 0 && (
        <div className="mx-4 mt-4 rounded-lg border border-line bg-white/70 p-4 text-sm sm:mx-10">
          <p className="font-medium">Your board is empty</p>
          <p className="mt-0.5 text-muted">
            Click <strong className="font-medium text-ink">New</strong> to add a business, use <strong className="font-medium text-ink">Find leads</strong> to let Claude
            search St. Louis for prospects, or connect an AI agent in Settings.
          </p>
        </div>
      )}

      <div className="min-h-[420px] flex-1 pt-4">
        <Board
          stages={stages}
          columns={columns}
          setColumns={setColumns}
          byId={byId}
          visible={visible}
          onOpen={setOpenId}
          onPersist={persist}
        />
      </div>

      {openBusiness && (
        <BusinessDrawer
          key={openBusiness._id}
          business={openBusiness}
          stages={stages}
          aiEnabled={aiEnabled}
          onClose={() => setOpenId(null)}
          onChange={upsert}
          onDelete={remove}
        />
      )}
      <AddBusinessModal open={showAdd} onClose={() => setShowAdd(false)} stages={stages} aiEnabled={aiEnabled} onCreated={upsert} />
      <FindLeadsModal
        open={showFind}
        onClose={() => setShowFind(false)}
        onAdded={(created) => created.forEach(upsert)}
        onRefresh={load}
        aiEnabled={aiEnabled}
      />
    </div>
  );
}

const statTones = {
  rose: "bg-rose-100 text-rose-700",
  yellow: "bg-yellow-100 text-yellow-800",
  lime: "bg-lime-100 text-lime-800",
};

function Dot() {
  return <span className="px-1 text-faint">·</span>;
}

function Stat({
  label,
  value,
  onClick,
  active,
  tone,
}: {
  label: string;
  value: number;
  onClick?: () => void;
  active?: boolean;
  tone?: keyof typeof statTones;
}) {
  const content = (
    <>
      <span className={clsx("rounded-[4px] px-1.5 font-semibold tabular-nums", tone && value > 0 ? statTones[tone] : "bg-[rgb(55_53_47/0.07)]")}>{value}</span>
      <span className="text-muted">{label}</span>
    </>
  );
  if (!onClick) return <span className="inline-flex items-center gap-1.5 px-1 py-0.5">{content}</span>;
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={clsx("inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-hover", active && "bg-hover ring-1 ring-line-strong")}
    >
      {content}
    </button>
  );
}
