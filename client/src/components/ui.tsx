import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import clsx from "clsx";
import { Loader2, X } from "lucide-react";

type Variant = "primary" | "ghost" | "danger" | "soft";

export function Button({
  variant = "soft",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
        variant === "primary" && "bg-accent text-white shadow-sm hover:bg-accent-strong",
        variant === "soft" && "border border-line-strong bg-white text-ink shadow-[0_1px_2px_rgb(15_15_15/0.04)] hover:bg-[#f7f7f5]",
        variant === "ghost" && "text-muted hover:bg-hover hover:text-ink",
        variant === "danger" && "text-[#d44c47] hover:bg-[#fdebec]",
        className,
      )}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx("field h-8 w-full rounded-md px-2.5 text-sm", className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx("field thin-scroll w-full rounded-md px-2.5 py-2 text-sm leading-relaxed", className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={clsx("field h-8 w-full rounded-md px-2 text-sm", className)}>
      {children}
    </select>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("animate-spin text-faint", className ?? "h-5 w-5")} />;
}

/** Notion-style color tags, using the app's pastel/neon palette. */
export const TAG_TONES = {
  gray: "bg-[rgb(55_53_47/0.07)] text-ink",
  pink: "bg-pink-100 text-pink-800",
  rose: "bg-rose-100 text-rose-700",
  orange: "bg-orange-100 text-orange-800",
  yellow: "bg-yellow-100 text-yellow-800",
  lime: "bg-lime-100 text-lime-800",
} as const;
export type Tone = keyof typeof TAG_TONES;

export function Tag({ tone = "gray", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={clsx("inline-flex max-w-full items-center gap-1 truncate rounded-[4px] px-1.5 py-px text-xs leading-5", TAG_TONES[tone], className)}>
      {children}
    </span>
  );
}

export function scoreTone(score: number): Tone {
  if (score >= 60) return "pink";
  if (score >= 30) return "yellow";
  return "lime";
}

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  return (
    <Tag tone={scoreTone(score)} className={clsx("font-semibold tabular-nums", className)} title="Opportunity score: higher means they're missing more (more you can help with)">
      {score}
    </Tag>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(15_15_15/0.18)] sm:items-start sm:p-4 sm:pt-[10vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx(
          "glass thin-scroll max-h-[90vh] w-full overflow-y-auto rounded-t-xl !bg-white/85 p-5 sm:rounded-xl sm:p-6",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-faint hover:bg-hover hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "rounded-[4px] px-2 py-0.5 text-xs leading-5 transition-colors",
        active ? "bg-pink-100 text-pink-800 ring-1 ring-pink-300" : "bg-[rgb(55_53_47/0.06)] text-muted hover:bg-[rgb(55_53_47/0.1)] hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** yyyy-mm-dd for <input type=date>, using UTC so the stored date doesn't shift a day. */
export function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

/** Follow-up dates are calendar days stored at UTC midnight, so show them in UTC. */
export function formatDay(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function isDue(value?: string | null) {
  if (!value) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return toDateInput(value) <= today;
}

export function hasNoWebsite(b: { website: string; audit?: { hasWebsite?: string } }) {
  return b.audit?.hasWebsite === "no" || (!b.website && b.audit?.hasWebsite !== "yes");
}

export function externalUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
