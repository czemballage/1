import * as THREE from 'three';

export type BlockId = 'grass' | 'stone' | 'wood' | 'sand';

export const BLOCK_IDS: BlockId[] = ['grass', 'stone', 'wood', 'sand'];

export interface BlockDef {
  id: BlockId;
  label: string;
  /** Data URL of the top face, used for the toolbar icon. */
  icon: string;
  /** Preview colour used by the placement ghost. */
  color: number;
  material: THREE.Material | THREE.Material[];
}

type RGB = [number, number, number];
type Rand = () => number;

function mulberry32(seed: number): Rand {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const jitter = (base: RGB, amount: number, r: Rand): RGB => {
  const d = (r() - 0.5) * amount;
  return [base[0] + d, base[1] + d, base[2] + d];
};

const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

/** Paint a 16x16 pixel texture procedurally (original art, no external assets). */
function paint(seed: number, fn: (x: number, y: number, r: Rand) => RGB): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const r = mulberry32(seed);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const [R, G, B] = fn(x, y, r);
      ctx.fillStyle = `rgb(${Math.round(R)},${Math.round(G)},${Math.round(B)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

const DIRT: RGB = [134, 96, 67];
const GRASS: RGB = [86, 158, 62];

const dirtPixel = (_x: number, _y: number, r: Rand): RGB => {
  const c = jitter(DIRT, 34, r);
  return r() < 0.08 ? shade(c, 0.78) : c;
};

const canvases = {
  grassTop: paint(1, (_x, _y, r) => jitter(GRASS, 38, r)),
  grassSide: paint(2, (x, y, r) => {
    const edge = y < 3 || (y === 3 && r() < 0.5) || (y === 4 && x % 3 === 0 && r() < 0.5);
    return edge ? jitter(GRASS, 38, r) : dirtPixel(x, y, r);
  }),
  dirt: paint(3, dirtPixel),
  stone: paint(4, (x, y, r) => {
    const c = jitter([128, 132, 138], 30, r);
    return (x + y * 3) % 7 === 0 && r() < 0.55 ? shade(c, 0.8) : c;
  }),
  wood: paint(5, (x, y, r) => {
    let c = jitter([182, 138, 82], 18, r);
    if (y % 4 === 3) c = shade(c, 0.74);
    const joint = Math.floor(y / 4) % 2 ? 4 : 11;
    if (x === joint) c = shade(c, 0.82);
    return c;
  }),
  sand: paint(6, (_x, _y, r) => jitter([226, 208, 141], 24, r)),
};

function material(canvas: HTMLCanvasElement): THREE.MeshLambertMaterial {
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.NearestMipmapLinearFilter;
  return new THREE.MeshLambertMaterial({ map });
}

const mats = {
  grassTop: material(canvases.grassTop),
  grassSide: material(canvases.grassSide),
  dirt: material(canvases.dirt),
  stone: material(canvases.stone),
  wood: material(canvases.wood),
  sand: material(canvases.sand),
};

export const BLOCKS: Record<BlockId, BlockDef> = {
  grass: {
    id: 'grass',
    label: 'عشب',
    icon: canvases.grassTop.toDataURL(),
    color: 0x569e3e,
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z
    material: [mats.grassSide, mats.grassSide, mats.grassTop, mats.dirt, mats.grassSide, mats.grassSide],
  },
  stone: { id: 'stone', label: 'حجر', icon: canvases.stone.toDataURL(), color: 0x80848a, material: mats.stone },
  wood: { id: 'wood', label: 'خشب', icon: canvases.wood.toDataURL(), color: 0xb68a52, material: mats.wood },
  sand: { id: 'sand', label: 'رمل', icon: canvases.sand.toDataURL(), color: 0xe2d08d, material: mats.sand },
};
