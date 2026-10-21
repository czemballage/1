import { BLOCK_IDS, type BlockId } from './blocks';

const KEY = 'realcraft-ar:v1';

type Quad = [number, number, number, number];

export interface SavedCluster {
  /** Position (grid units, relative to the first structure) and yaw in radians. */
  pose: Quad;
  /** [x, y, z, blockIndex] inside the cluster. */
  blocks: Quad[];
}

export interface SavedState {
  clusters: SavedCluster[];
  inventory: Record<BlockId, number>;
  selected: BlockId;
}

export function defaultInventory(): Record<BlockId, number> {
  return { grass: 24, stone: 24, wood: 24, sand: 24 };
}

const isQuad = (q: unknown, integer: boolean): q is Quad =>
  Array.isArray(q) && q.length === 4 && q.every((v) => (integer ? Number.isInteger(v) : Number.isFinite(v)));

export function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data.inventory !== 'object' || !data.inventory) return null;

    let clusters: SavedCluster[] = [];
    if (Array.isArray(data.clusters)) {
      clusters = (data.clusters as Record<string, unknown>[])
        .filter((c) => c && isQuad(c.pose, false) && Array.isArray(c.blocks))
        .map((c) => ({ pose: c.pose as Quad, blocks: (c.blocks as unknown[]).filter((b): b is Quad => isQuad(b, true)) }));
    } else if (Array.isArray(data.blocks)) {
      // v1 save: a single grid.
      clusters = [{ pose: [0, 0, 0, 0], blocks: (data.blocks as unknown[]).filter((b): b is Quad => isQuad(b, true)) }];
    }

    const inventory = defaultInventory();
    for (const id of BLOCK_IDS) {
      const n = Number((data.inventory as Record<string, unknown>)[id]);
      if (Number.isFinite(n) && n >= 0) inventory[id] = Math.min(999, Math.floor(n));
    }
    const selected = BLOCK_IDS.includes(data.selected as BlockId) ? (data.selected as BlockId) : 'grass';
    return { clusters, inventory, selected };
  } catch {
    return null;
  }
}

export function saveState(state: SavedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private mode / quota); the game keeps working without persistence.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
