import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { Business, Stage } from "../../lib/types";
import { Column } from "./Column";
import { CardView } from "./BusinessCard";

export type Columns = Record<string, string[]>;

/** Groups business ids by stage, ordered by `order`. Unknown stages fall into the first column. */
export function buildColumns(stages: Stage[], businesses: Business[]): Columns {
  const cols: Columns = Object.fromEntries(stages.map((s) => [s.id, []]));
  const sorted = [...businesses].sort((a, b) => a.order - b.order);
  for (const b of sorted) {
    const key = cols[b.status] ? b.status : stages[0]?.id;
    if (key) cols[key].push(b._id);
  }
  return cols;
}

export function Board({
  stages,
  columns,
  setColumns,
  byId,
  visible,
  onOpen,
  onPersist,
}: {
  stages: Stage[];
  columns: Columns;
  setColumns: (updater: (prev: Columns) => Columns) => void;
  byId: Map<string, Business>;
  visible: (b: Business) => boolean;
  onOpen: (id: string) => void;
  onPersist: (changed: { id: string; status: string; order: number }[]) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const startColumn = useRef<string | null>(null);
  const snapshot = useRef<Columns | null>(null);
  // Latest columns during a drag (state updates are async).
  const columnsRef = useRef(columns);
  useLayoutEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter opens a card, so only Space picks one up.
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  const findColumn = (id: UniqueIdentifier, cols = columnsRef.current): string | undefined => {
    const key = String(id);
    if (key in cols) return key;
    return Object.keys(cols).find((c) => cols[c].includes(key));
  };

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    startColumn.current = findColumn(active.id) ?? null;
    snapshot.current = columnsRef.current;
  }

  function onDragCancel() {
    setActiveId(null);
    if (snapshot.current) {
      const saved = snapshot.current;
      setColumns(() => saved);
    }
    snapshot.current = null;
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);
    const activeRect = active.rect.current.translated;
    const below = !!activeRect && activeRect.top > over.rect.top + over.rect.height / 2;

    setColumns((prev) => {
      const from = findColumn(activeKey, prev);
      const to = findColumn(overKey, prev);
      if (!from || !to || from === to) return prev;
      const fromItems = prev[from].filter((id) => id !== activeKey);
      const toItems = [...prev[to]];
      const overIndex = toItems.indexOf(overKey);
      const index = overIndex === -1 ? toItems.length : overIndex + (below ? 1 : 0);
      toItems.splice(index, 0, activeKey);
      return { ...prev, [from]: fromItems, [to]: toItems };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const origin = startColumn.current;
    startColumn.current = null;
    if (!over || !origin) {
      onDragCancel();
      return;
    }
    snapshot.current = null;

    const activeKey = String(active.id);
    const overKey = String(over.id);
    const target = findColumn(over.id);
    if (!target) return;

    let next = columnsRef.current;
    const items = next[target];
    const oldIndex = items.indexOf(activeKey);
    const newIndex = items.indexOf(overKey);
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      next = { ...next, [target]: arrayMove(items, oldIndex, newIndex) };
      setColumns(() => next);
    }

    const finalColumn = findColumn(activeKey, next) ?? target;
    const touched = new Set([origin, finalColumn]);
    const changed = [...touched].flatMap((col) => next[col].map((id, order) => ({ id, status: col, order })));
    const moved = origin !== finalColumn || oldIndex !== newIndex;
    if (moved) onPersist(changed);
  }

  const active = activeId ? byId.get(activeId) : undefined;

  const visibleColumns = useMemo(
    () =>
      Object.fromEntries(
        stages.map((s) => [
          s.id,
          (columns[s.id] ?? []).map((id) => byId.get(id)).filter((b): b is Business => !!b && (b._id === activeId || visible(b))),
        ]),
      ),
    [stages, columns, byId, visible, activeId],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="thin-scroll flex h-full snap-x gap-2.5 overflow-x-auto px-4 pb-4 sm:px-10">
        {stages.map((stage) => (
          <Column
            key={stage.id}
            stage={stage}
            businesses={visibleColumns[stage.id] ?? []}
            total={columns[stage.id]?.length ?? 0}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay>{active ? <CardView business={active} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
