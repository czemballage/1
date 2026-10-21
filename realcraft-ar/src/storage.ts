import { BLOCK_IDS, type BlockId } from './blocks';

const KEY = 'realcraft-ar:v1';

export interface SavedState {
  /** [x, y, z, blockIndex] — enough to rebuild the structure relative to its origin. */
  blocks: [number, number, number, number][];
  inventory: Record<BlockId, number>;
  selected: BlockId;
}

export function defaultInventory(): Record<BlockId, number> {
  return { grass: 24, stone: 24, wood: 24, sand: 24 };
}

export function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SavedState>;
    if (!Array.isArray(data.blocks) || typeof data.inventory !== 'object' || !data.inventory) return null;
    const inventory = defaultInventory();
    for (const id of BLOCK_IDS) {
      const n = Number((data.inventory as Record<string, unknown>)[id]);
      if (Number.isFinite(n) && n >= 0) inventory[id] = Math.min(999, Math.floor(n));
    }
    const blocks = data.blocks.filter(
      (b): b is [number, number, number, number] =>
        Array.isArray(b) && b.length === 4 && b.every((v) => Number.isInteger(v)),
    );
    const selected = BLOCK_IDS.includes(data.selected as BlockId) ? (data.selected as BlockId) : 'grass';
    return { blocks, inventory, selected };
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
