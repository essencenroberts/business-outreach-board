import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { Bot, CalendarClock, Globe, Phone, Sparkles } from "lucide-react";
import type { Business } from "../../lib/types";
import { ScoreBadge, Tag, formatDay, hasNoWebsite, isDue } from "../ui";

const priorityLabel: Record<Business["priority"], { text: string; tone: "pink" | "orange" | "gray" } | null> = {
  high: { text: "High", tone: "pink" },
  medium: null,
  low: { text: "Low", tone: "gray" },
};

export function CardView({ business, dragging, overlay }: { business: Business; dragging?: boolean; overlay?: boolean }) {
  const noSite = hasNoWebsite(business);
  const due = isDue(business.followUpDate);
  const place = [business.category, business.neighborhood].filter(Boolean).join(" · ");
  const priority = priorityLabel[business.priority];

  return (
    <div
      className={clsx(
        "card group cursor-grab rounded-lg px-2.5 py-2 text-left transition-[background,box-shadow] active:cursor-grabbing",
        dragging && "opacity-30",
        overlay && "rotate-[1.5deg] shadow-[0_12px_32px_rgb(15_15_15/0.16)]",
        !dragging && !overlay && "hover:bg-[#fafaf9] hover:shadow-[0_2px_6px_rgb(15_15_15/0.07)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-sm font-medium leading-snug">{business.name}</h3>
        <ScoreBadge score={business.opportunityScore} className="shrink-0" />
      </div>
      {place && <p className="mt-0.5 truncate text-xs text-muted">{place}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {noSite ? (
          <Tag tone="rose">No website</Tag>
        ) : (
          <Tag className="max-w-[160px]">
            <Globe className="h-3 w-3 shrink-0 text-muted" />
            <span className="truncate">{business.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
          </Tag>
        )}
        {priority && <Tag tone={priority.tone}>{priority.text}</Tag>}
        {business.services.slice(0, 2).map((s) => (
          <Tag key={s} tone="orange">
            {s}
          </Tag>
        ))}
        {business.services.length > 2 && <span className="text-xs text-faint">+{business.services.length - 2}</span>}
      </div>

      {(business.followUpDate || business.phone || business.source === "agent" || business.source === "ai-find") && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          {business.followUpDate && (
            <span className={clsx("inline-flex items-center gap-1", due && "rounded-[4px] bg-yellow-100 px-1.5 py-px font-medium text-yellow-800")}>
              <CalendarClock className="h-3 w-3" />
              {formatDay(business.followUpDate)}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5 text-faint">
            {business.phone && <Phone className="h-3 w-3" aria-label="Has phone" />}
            {business.source === "agent" && <Bot className="h-3 w-3" aria-label="Added by an AI agent" />}
            {business.source === "ai-find" && <Sparkles className="h-3 w-3" aria-label="Found by Claude" />}
          </span>
        </div>
      )}
    </div>
  );
}

export function SortableBusinessCard({ business, onOpen }: { business: Business; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: business._id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(business._id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(business._id);
        listeners?.onKeyDown?.(e);
      }}
      aria-label={`${business.name}. Press space to pick up and move, Enter to open.`}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <CardView business={business} dragging={isDragging} />
    </div>
  );
}
