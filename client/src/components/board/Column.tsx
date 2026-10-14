import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import clsx from "clsx";
import type { Business, Stage } from "../../lib/types";
import { SortableBusinessCard } from "./BusinessCard";

/** Stage pill: the stage color as a soft tint behind dark text, like a Notion status option. */
export function StagePill({ stage }: { stage: Stage }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2 py-px text-xs font-medium leading-5 text-ink"
      style={{ background: `${stage.color}33` }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: stage.color }} />
      <span className="truncate">{stage.label}</span>
    </span>
  );
}

export function Column({
  stage,
  businesses,
  total,
  onOpen,
}: {
  stage: Stage;
  businesses: Business[];
  total: number;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <section
      className={clsx(
        "glass-soft flex max-h-full w-[82vw] shrink-0 snap-start flex-col rounded-xl transition-colors sm:w-[272px]",
        isOver && "!bg-white/70 ring-1 ring-accent/30",
      )}
      aria-label={stage.label}
    >
      <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-2.5">
        <StagePill stage={stage} />
        <span className="text-xs tabular-nums text-faint">{businesses.length === total ? total : `${businesses.length} of ${total}`}</span>
      </div>
      <SortableContext id={stage.id} items={businesses.map((b) => b._id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="thin-scroll flex min-h-20 flex-1 flex-col gap-1.5 overflow-y-auto px-1.5 pb-2">
          {businesses.map((b) => (
            <SortableBusinessCard key={b._id} business={b} onOpen={onOpen} />
          ))}
          {businesses.length === 0 && (
            <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-line-strong text-xs text-faint">No businesses</div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
