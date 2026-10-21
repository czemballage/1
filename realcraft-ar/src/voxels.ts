import * as THREE from 'three';
import { BLOCKS, BLOCK_IDS, type BlockId } from './blocks';

/** The world spans cells x,z in [-BOUND, BOUND) and y in [0, MAX_H). One cell = one block. */
export const BOUND = 16;
export const MAX_H = 24;
const CAPACITY = 2 * BOUND * 2 * BOUND * MAX_H;

export type Cell = [number, number, number];

export class VoxelWorld {
  private cells = new Map<number, BlockId>();
  private counts: Record<BlockId, number> = { grass: 0, stone: 0, wood: 0, sand: 0 };

  private static key(x: number, y: number, z: number): number {
    return (x + BOUND) * 1024 + (z + BOUND) * 32 + y;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= -BOUND && x < BOUND && z >= -BOUND && z < BOUND && y >= 0 && y < MAX_H;
  }

  get(x: number, y: number, z: number): BlockId | undefined {
    return this.cells.get(VoxelWorld.key(x, y, z));
  }

  set(x: number, y: number, z: number, id: BlockId): void {
    this.delete(x, y, z);
    this.cells.set(VoxelWorld.key(x, y, z), id);
    this.counts[id]++;
  }

  delete(x: number, y: number, z: number): BlockId | undefined {
    const k = VoxelWorld.key(x, y, z);
    const old = this.cells.get(k);
    if (old) {
      this.cells.delete(k);
      this.counts[old]--;
    }
    return old;
  }

  clear(): void {
    this.cells.clear();
    for (const id of BLOCK_IDS) this.counts[id] = 0;
  }

  get size(): number {
    return this.cells.size;
  }

  *entries(): Generator<[number, number, number, BlockId]> {
    for (const [k, id] of this.cells) {
      yield [(k >> 10) - BOUND, k & 31, ((k >> 5) & 31) - BOUND, id];
    }
  }
}

/** Instanced rendering: one draw call per block type regardless of block count. */
export class VoxelMeshes {
  readonly group = new THREE.Group();
  private meshes = new Map<BlockId, THREE.InstancedMesh>();
  private dirty = true;
  private matrix = new THREE.Matrix4();

  constructor(private world: VoxelWorld) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    for (const id of BLOCK_IDS) {
      const mesh = new THREE.InstancedMesh(geometry, BLOCKS[id].material, CAPACITY);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.meshes.set(id, mesh);
      this.group.add(mesh);
    }
  }

  markDirty(): void {
    this.dirty = true;
  }

  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const used: Record<BlockId, number> = { grass: 0, stone: 0, wood: 0, sand: 0 };
    for (const [x, y, z, id] of this.world.entries()) {
      this.matrix.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
      this.meshes.get(id)!.setMatrixAt(used[id]++, this.matrix);
    }
    for (const id of BLOCK_IDS) {
      const mesh = this.meshes.get(id)!;
      mesh.count = used[id];
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

export interface Hit {
  kind: 'block' | 'floor';
  /** The solid cell that was hit (blocks only). */
  cell: Cell | null;
  /** The empty cell in front of the hit face, where a new block would go. */
  place: Cell | null;
}

/**
 * Amanatides–Woo voxel traversal in world-local grid units.
 * The floor is the plane y = 0 (the top of cell layer y = 0 sits at y = 1).
 */
export function raycastVoxels(world: VoxelWorld, origin: THREE.Vector3, dir: THREE.Vector3, maxSteps = 400): Hit | null {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  if (y < 0) return null;

  const stepX = dir.x > 0 ? 1 : -1;
  const stepY = dir.y > 0 ? 1 : -1;
  const stepZ = dir.z > 0 ? 1 : -1;
  const dX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const dY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const dZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
  let tX = dir.x !== 0 ? (dir.x > 0 ? x + 1 - origin.x : origin.x - x) * dX : Infinity;
  let tY = dir.y !== 0 ? (dir.y > 0 ? y + 1 - origin.y : origin.y - y) * dY : Infinity;
  let tZ = dir.z !== 0 ? (dir.z > 0 ? z + 1 - origin.z : origin.z - z) * dZ : Infinity;

  let prev: Cell | null = null;
  for (let i = 0; i < maxSteps; i++) {
    if (y < 0) {
      // Crossed the floor plane from the cell above it.
      if (prev && world.inBounds(prev[0], prev[1], prev[2])) return { kind: 'floor', cell: null, place: prev };
      return null;
    }
    if (world.get(x, y, z)) return { kind: 'block', cell: [x, y, z], place: prev };
    prev = [x, y, z];
    if (tX < tY && tX < tZ) {
      x += stepX;
      tX += dX;
    } else if (tY < tZ) {
      y += stepY;
      tY += dY;
    } else {
      z += stepZ;
      tZ += dZ;
    }
  }
  return null;
}
