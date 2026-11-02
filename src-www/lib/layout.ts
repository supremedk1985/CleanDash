/**
 * Order of the tiles, per device. In move mode (started from the "Infos & Diagnose" tile) tiles are dragged to another
 * place or column and hidden; "Fertig" saves the arrangement in this browser. It is deliberately per device: the
 * kitchen tablet and a phone can order their tiles differently. Tiles that are set up later and are not in the saved
 * arrangement land in their default column; tiles no longer set up drop out.
 */
import { ref } from "vue";

export interface Layout {
  cols: string[][];
  hidden: string[];
}

export interface TileDef {
  id: string;
  /** default column: 0 left, 1 middle, 2 right */
  col: number;
}

/** Always last in the right column, never hidden: the way back into move mode. */
export const PINNED = "settings";
const COLUMNS = 3;

/**
 * The columns to show. `defs` are the tiles that are set up, in default order. `raise` moves one tile to second place
 * in its column (a running print). Hidden tiles stay in the columns only while moving.
 */
export function arrange(defs: TileDef[], saved: Layout | null, opts: { moving?: boolean; raise?: string } = {}): Layout {
  const present = new Map(defs.map((d) => [d.id, d]));
  const cols: string[][] = Array.from({ length: COLUMNS }, (_, i) =>
    (saved?.cols[i] ?? []).filter((id, k, all) => present.has(id) && id !== PINNED && all.indexOf(id) === k));
  const placed = new Set(cols.flat());
  defs.forEach((d, order) => {
    if (d.id === PINNED || placed.has(d.id)) return;
    const col = cols[Math.min(Math.max(d.col, 0), COLUMNS - 1)];
    // after the last tile of this column that comes before it in the default order
    const before = defs.slice(0, order).map((x) => x.id);
    let at = 0;
    col.forEach((id, k) => { if (before.includes(id)) at = k + 1; });
    col.splice(at, 0, d.id);
    placed.add(d.id);
  });
  const hidden = (saved?.hidden ?? []).filter((id) => present.has(id) && id !== PINNED);
  const out = opts.moving ? cols : cols.map((c) => c.filter((id) => !hidden.includes(id)));
  if (opts.raise && !opts.moving) {
    for (const c of out) {
      const k = c.indexOf(opts.raise);
      if (k > 1) { c.splice(k, 1); c.splice(1, 0, opts.raise); }
    }
  }
  if (present.has(PINNED)) out[COLUMNS - 1].push(PINNED);
  return { cols: out, hidden };
}

/** `id` taken out of wherever it is and put into column `col` at `index`. */
export function moveTile(l: Layout, id: string, col: number, index: number): Layout {
  const cols = l.cols.map((c) => c.filter((x) => x !== id && x !== PINNED));
  const target = cols[col];
  target.splice(Math.min(Math.max(index, 0), target.length), 0, id);
  return { cols, hidden: [...l.hidden] };
}

export function toggleHidden(l: Layout, id: string): Layout {
  if (id === PINNED) return l;
  const hidden = l.hidden.includes(id) ? l.hidden.filter((x) => x !== id) : [...l.hidden, id];
  return { cols: l.cols.map((c) => [...c]), hidden };
}

function storageKey(): string {
  let instance = "0";
  try { instance = new URLSearchParams(location.search).get("instance") || "0"; } catch { /* no location in tests */ }
  return `cleandash.layout.${instance}`;
}

export function loadLayout(): Layout | null {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return null;
    const l = JSON.parse(raw) as Layout;
    return Array.isArray(l?.cols) && Array.isArray(l?.hidden) ? l : null;
  } catch {
    return null;
  }
}

/** The saved arrangement of this device (null = default order). */
export const savedLayout = ref<Layout | null>(loadLayout());
/** The arrangement being edited; null when not in move mode. */
export const draft = ref<Layout | null>(null);

export function startMoving(current: Layout) {
  draft.value = { cols: current.cols.map((c) => c.filter((id) => id !== PINNED)), hidden: [...current.hidden] };
}

export const moveRequested = ref(0);
/** Called from the "Infos & Diagnose" tile; App.vue answers with startMoving(). */
export function requestMoveMode() { moveRequested.value++; }

export function finishMoving(save: boolean) {
  if (save && draft.value) {
    savedLayout.value = draft.value;
    try { localStorage.setItem(storageKey(), JSON.stringify(draft.value)); } catch { /* private mode: kept until reload */ }
  }
  draft.value = null;
}

/** Back to the default order (still in move mode; "Fertig" makes it stick). */
export function resetDraft() {
  draft.value = { cols: [[], [], []], hidden: [] };
}
