import * as THREE from 'three';
import { BLOCKS, BLOCK_IDS, type BlockId } from './blocks';

/** A grid spans cells x,z in [-BOUND, BOUND) and y in [Y_MIN, MAX_H). One cell = one block. */
export const BOUND = 16;
export const Y_MIN = -16;
export const MAX_H = 24;

export type Cell = [number, number, number];

export class VoxelWorld {
  private cells = new Map<number, BlockId>();
  readonly counts: Record<BlockId, number> = { grass: 0, stone: 0, wood: 0, sand: 0 };

  private static key(x: number, y: number, z: number): number {
    return ((x + BOUND) * 32 + (z + BOUND)) * 64 + (y - Y_MIN);
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= -BOUND && x < BOUND && z >= -BOUND && z < BOUND && y >= Y_MIN && y < MAX_H;
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
      yield [(k >> 11) - BOUND, (k & 63) + Y_MIN, ((k >> 6) & 31) - BOUND, id];
    }
  }
}

/** Instanced rendering: one draw call per block type; capacity grows on demand. */
export class VoxelMeshes {
  readonly group = new THREE.Group();
  private meshes = new Map<BlockId, THREE.InstancedMesh>();
  private dirty = true;
  private matrix = new THREE.Matrix4();
  private static geometry = new THREE.BoxGeometry(1, 1, 1);

  constructor(private world: VoxelWorld) {
    for (const id of BLOCK_IDS) this.meshes.set(id, this.create(id, 64));
  }

  private create(id: BlockId, capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(VoxelMeshes.geometry, BLOCKS[id].material, capacity);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.group.add(mesh);
    return mesh;
  }

  markDirty(): void {
    this.dirty = true;
  }

  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    for (const id of BLOCK_IDS) {
      const needed = this.world.counts[id];
      const mesh = this.meshes.get(id)!;
      if (needed > mesh.instanceMatrix.count) {
        let capacity = mesh.instanceMatrix.count;
        while (capacity < needed) capacity *= 2;
        this.group.remove(mesh);
        mesh.dispose();
        this.meshes.set(id, this.create(id, capacity));
      }
    }
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

  dispose(): void {
    for (const mesh of this.meshes.values()) mesh.dispose();
  }
}

/**
 * One rigid voxel grid. In AR every structure that rests on a different real surface (floor, table top,
 * wall…) gets its own cluster aligned and anchored to that surface, so blocks sit flush on it instead of
 * snapping to a single global grid.
 */
export class Cluster {
  readonly world = new VoxelWorld();
  readonly meshes = new VoxelMeshes(this.world);
  readonly group = new THREE.Group();
  anchor: XRAnchor | null = null;

  constructor() {
    this.group.add(this.meshes.group);
  }

  setPose(x: number, y: number, z: number, yaw: number): void {
    this.group.position.set(x, y, z);
    this.group.rotation.set(0, yaw, 0);
  }

  dispose(): void {
    this.anchor?.delete();
    this.anchor = null;
    this.meshes.dispose();
  }
}

export interface Hit {
  kind: 'block' | 'floor';
  /** The solid cell that was hit (blocks only). */
  cell: Cell | null;
  /** The empty cell in front of the hit face, where a new block would go. */
  place: Cell | null;
  /** Distance along the ray to the hit, in grid units. */
  t: number;
}

/**
 * Amanatides–Woo voxel traversal in grid units. With `floor`, the plane y = 0 is solid ground.
 */
export function raycastVoxels(
  world: VoxelWorld,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  opts: { floor: boolean; maxDist: number },
): Hit | null {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  if (opts.floor && y < 0) return null;

  const stepX = dir.x > 0 ? 1 : -1;
  const stepY = dir.y > 0 ? 1 : -1;
  const stepZ = dir.z > 0 ? 1 : -1;
  const dX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const dY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const dZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
  let tX = dir.x !== 0 ? (dir.x > 0 ? x + 1 - origin.x : origin.x - x) * dX : Infinity;
  let tY = dir.y !== 0 ? (dir.y > 0 ? y + 1 - origin.y : origin.y - y) * dY : Infinity;
  let tZ = dir.z !== 0 ? (dir.z > 0 ? z + 1 - origin.z : origin.z - z) * dZ : Infinity;

  let t = 0;
  let prev: Cell | null = null;
  while (t <= opts.maxDist) {
    if (opts.floor && y < 0) {
      // Crossed the floor plane from the cell above it.
      if (prev && world.inBounds(prev[0], prev[1], prev[2])) return { kind: 'floor', cell: null, place: prev, t };
      return null;
    }
    if (world.get(x, y, z)) return { kind: 'block', cell: [x, y, z], place: prev, t };
    prev = [x, y, z];
    if (tX < tY && tX < tZ) {
      x += stepX;
      t = tX;
      tX += dX;
    } else if (tY < tZ) {
      y += stepY;
      t = tY;
      tY += dY;
    } else {
      z += stepZ;
      t = tZ;
      tZ += dZ;
    }
  }
  return null;
}
