import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BLOCKS, BLOCK_IDS, type BlockId } from './blocks';
import { BOUND, Cluster, MAX_H, raycastVoxels, type Cell, type Hit } from './voxels';
import { clearState, defaultInventory, loadState, saveState, type SavedCluster } from './storage';
import { detectAR, explainXRError } from './xr';
import { DepthOcclusion, LightEstimator, RealPlanes } from './ar-env';

type Tool = 'place' | 'break';
type Mode = 'menu' | 'sandbox' | 'ar';

/** In AR one block is 10 cm wide. */
const AR_BLOCK_SIZE = 0.1;
/** How far (in blocks) a real surface may be from an existing grid layer and still extend that grid. */
const FIT_TOLERANCE = 0.2;
/** Depth margin (meters) before a cell counts as being inside a real object. */
const OBSTACLE_MARGIN = 0.035;
const MAX_CLUSTERS = 24;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const ui = {
  root: $('ui'),
  hud: $('hud'),
  home: $('home'),
  help: $('help'),
  error: $('error'),
  errorText: $('error-text'),
  confirm: $('confirm'),
  toast: $('toast'),
  hint: $('hint'),
  crosshair: $('crosshair'),
  hotbar: $('hotbar'),
  tool: $('btn-tool'),
  modeLabel: $('mode-label'),
  features: $('ar-features'),
  replace: $('btn-replace'),
  arStatus: $('ar-status'),
  start: $('btn-start'),
  sandbox: $('btn-sandbox'),
};

/* ------------------------------------------------------------------ three */

const canvas = $<HTMLCanvasElement>('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local');

const SKY = new THREE.Color(0x8ec9ee);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.02, 400);
camera.position.set(15, 14, 19);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 2, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.04;
controls.minDistance = 4;
controls.maxDistance = 80;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

/** The whole build. Scale 1 in sandbox (1 unit = 1 block), 0.1 in AR (1 block = 10 cm). */
const root = new THREE.Group();
scene.add(root);

const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.15);
const sun = new THREE.DirectionalLight(0xffffff, 2.1);
const SUN_DEFAULT = new THREE.Vector3(12, 24, 8);
sun.position.copy(SUN_DEFAULT);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
root.add(hemi, sun, sun.target);

function setShadowBounds(half: number, near: number, far: number): void {
  const c = sun.shadow.camera;
  c.left = -half;
  c.right = half;
  c.top = half;
  c.bottom = -half;
  c.near = near;
  c.far = far;
  c.updateProjectionMatrix();
}

// Sandbox ground.
const groundTexture = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 2;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5da34a';
  g.fillRect(0, 0, 2, 2);
  g.fillStyle = '#54983f';
  g.fillRect(0, 0, 1, 1);
  g.fillRect(1, 1, 1, 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(BOUND, BOUND);
  return t;
})();
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(BOUND * 2, BOUND * 2).rotateX(-Math.PI / 2),
  new THREE.MeshLambertMaterial({ map: groundTexture }),
);
ground.receiveShadow = true;
root.add(ground);

// AR fallback shadow catcher under the first structure, used only when plane detection is unavailable.
const arFloor = new THREE.Mesh(
  new THREE.PlaneGeometry(BOUND * 2, BOUND * 2).rotateX(-Math.PI / 2),
  new THREE.ShadowMaterial({ opacity: 0.35 }),
);
arFloor.receiveShadow = true;
arFloor.position.y = 0.002;
arFloor.visible = false;
root.add(arFloor);

// Placement ghost (re-parented to whichever grid it targets).
const ghost = new THREE.Group();
const ghostFill = new THREE.Mesh(
  new THREE.BoxGeometry(1.01, 1.01, 1.01),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false }),
);
const ghostEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.012, 1.012, 1.012)),
  new THREE.LineBasicMaterial({ color: 0xffffff }),
);
ghost.add(ghostFill, ghostEdges);
ghost.visible = false;
/** Pose of a grid that does not exist yet (a new real surface). */
const pendingGroup = new THREE.Group();
root.add(pendingGroup);

// AR reticle on real surfaces (world space).
const reticle = new THREE.Group();
reticle.matrixAutoUpdate = false;
reticle.visible = false;
reticle.add(
  new THREE.Mesh(new THREE.RingGeometry(0.07, 0.09, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x42c28a })),
  new THREE.Mesh(new THREE.CircleGeometry(0.01, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff })),
);
scene.add(reticle);

// Environment understanding.
const depth = new DepthOcclusion();
const planes = new RealPlanes();
const light = new LightEstimator();
scene.add(planes.group, light.probe);

const occluded = new Set<THREE.Material>([
  ghostFill.material,
  ghostEdges.material,
  arFloor.material,
  planes.shadowMaterial,
  planes.scanMaterial,
]);
for (const id of BLOCK_IDS) {
  const m = BLOCKS[id].material;
  (Array.isArray(m) ? m : [m]).forEach((mat) => occluded.add(mat));
}
occluded.forEach((m) => depth.patch(m));

/* ------------------------------------------------------------------ state */

const state = {
  mode: 'menu' as Mode,
  tool: 'place' as Tool,
  selected: 'grass' as BlockId,
  inventory: defaultInventory(),
  clusters: [] as Cluster[],
  ar: { supported: false, reason: '' },
};

function addCluster(): Cluster {
  const c = new Cluster();
  root.add(c.group);
  state.clusters.push(c);
  return c;
}

function removeCluster(c: Cluster): void {
  if (c === state.clusters[0]) return; // the first grid is the reference for everything else
  if (ghost.parent === c.group) pendingGroup.add(ghost);
  root.remove(c.group);
  c.dispose();
  state.clusters.splice(state.clusters.indexOf(c), 1);
}

function restore(): void {
  const saved = loadState();
  const first = addCluster();
  if (!saved) return;
  saved.clusters.forEach((sc, i) => {
    const c = i === 0 ? first : addCluster();
    if (i > 0) c.setPose(...sc.pose);
    for (const [x, y, z, b] of sc.blocks) {
      const id = BLOCK_IDS[b];
      if (id && c.world.inBounds(x, y, z)) c.world.set(x, y, z, id);
    }
    c.meshes.markDirty();
  });
  for (const c of state.clusters.slice(1)) if (c.world.size === 0) removeCluster(c);
  state.inventory = saved.inventory;
  state.selected = saved.selected;
}

let saveTimer = 0;
function persist(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const clusters: SavedCluster[] = state.clusters.map((c) => {
      const blocks: SavedCluster['blocks'] = [];
      for (const [x, y, z, id] of c.world.entries()) blocks.push([x, y, z, BLOCK_IDS.indexOf(id)]);
      const p = c.group.position;
      return { pose: [p.x, p.y, p.z, c.group.rotation.y], blocks };
    });
    saveState({ clusters, inventory: state.inventory, selected: state.selected });
  }, 350);
}

/** The first grid sits on its real surface: nothing may go below it. */
function cellAllowed(c: Cluster, cell: Cell): boolean {
  return c.world.inBounds(...cell) && (c !== state.clusters[0] || cell[1] >= 0);
}

/* ------------------------------------------------------------------ targeting */

interface BuildTarget {
  action: Tool;
  cluster: Cluster | null;
  cell: Cell;
  /** Set when the block starts a new grid on a real surface (world-space pose). */
  newCluster?: { origin: THREE.Vector3; yaw: number };
  blocked?: string;
}

const inverse = new THREE.Matrix4();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Cast a world-space ray through every grid and return the nearest voxel hit. */
function castClusters(origin: THREE.Vector3, dir: THREE.Vector3, floor: boolean, maxDist: number) {
  let best: { cluster: Cluster; hit: Hit; dist: number } | null = null;
  root.updateMatrixWorld(true);
  for (const c of state.clusters) {
    inverse.copy(c.group.matrixWorld).invert();
    const o = origin.clone().applyMatrix4(inverse);
    const d = origin.clone().add(dir).applyMatrix4(inverse).sub(o);
    const unitsPerMeter = d.length();
    d.normalize();
    const hit = raycastVoxels(c.world, o, d, { floor: floor && c === state.clusters[0], maxDist: maxDist * unitsPerMeter });
    if (hit) {
      const dist = hit.t / unitsPerMeter;
      if (!best || dist < best.dist) best = { cluster: c, hit, dist };
    }
  }
  return best;
}

function voxelTarget(cluster: Cluster, hit: Hit, tool: Tool): BuildTarget | null {
  if (tool === 'break') {
    return hit.kind === 'block' && hit.cell ? { action: 'break', cluster, cell: hit.cell } : null;
  }
  if (!hit.place) return null;
  const t: BuildTarget = { action: 'place', cluster, cell: hit.place };
  if (!cellAllowed(cluster, hit.place)) t.blocked = hit.place[1] >= MAX_H ? 'وصلت إلى أقصى ارتفاع' : 'خارج حدود البناء';
  return t;
}

function sandboxTarget(clientX: number, clientY: number, tool: Tool): BuildTarget | null {
  const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const r = castClusters(raycaster.ray.origin, raycaster.ray.direction, true, 1000);
  return r ? voxelTarget(r.cluster, r.hit, tool) : null;
}

/** Centre of a target cell in world space. */
function targetCenter(t: BuildTarget): THREE.Vector3 {
  const local = new THREE.Vector3(t.cell[0] + 0.5, t.cell[1] + 0.5, t.cell[2] + 0.5);
  if (t.cluster) return t.cluster.group.localToWorld(local);
  return pendingGroup.localToWorld(local);
}

function updateGhost(t: BuildTarget | null): void {
  if (!t || (t.blocked && !t.cluster && !t.newCluster)) {
    ghost.visible = false;
    return;
  }
  const parent = t.cluster ? t.cluster.group : pendingGroup;
  if (ghost.parent !== parent) parent.add(ghost);
  ghost.position.set(t.cell[0] + 0.5, t.cell[1] + 0.5, t.cell[2] + 0.5);
  const fill = ghostFill.material as THREE.MeshBasicMaterial;
  const edges = ghostEdges.material as THREE.LineBasicMaterial;
  if (t.blocked || t.action === 'break') {
    fill.color.setHex(0xe5604f);
    edges.color.setHex(0xff8a7a);
    fill.opacity = t.blocked ? 0.28 : 0.45;
  } else {
    fill.color.setHex(BLOCKS[state.selected].color);
    edges.color.setHex(0xffffff);
    fill.opacity = 0.5;
  }
  ghost.visible = true;
}

/* ------------------------------------------------------------------ gameplay */

function commit(t: BuildTarget | null, frame?: XRFrame, ref?: XRReferenceSpace): void {
  if (!t) {
    if (state.mode === 'ar') toast(state.tool === 'break' ? 'صوّب الـ + نحو مكعب لتكسيره' : 'صوّب الـ + نحو سطح حقيقي أو مكعب');
    return;
  }
  if (t.blocked) {
    toast(t.blocked);
    return;
  }
  if (t.action === 'break') {
    const c = t.cluster!;
    const removed = c.world.delete(...t.cell);
    if (removed) state.inventory[removed] = Math.min(999, state.inventory[removed] + 1);
    c.meshes.markDirty();
    if (c.world.size === 0) removeCluster(c);
  } else {
    const id = state.selected;
    if (state.inventory[id] <= 0) {
      toast(`لا تملك مكعبات ${BLOCKS[id].label} — كسّر بعضها لجمعها`);
      return;
    }
    let c = t.cluster;
    if (!c && t.newCluster) {
      if (state.clusters.length >= MAX_CLUSTERS) {
        toast('وصلت إلى الحد الأقصى من الأسطح المختلفة — ابنِ فوق المكعبات الموجودة');
        return;
      }
      c = addCluster();
      const local = root.worldToLocal(t.newCluster.origin.clone());
      c.setPose(local.x, local.y, local.z, t.newCluster.yaw - root.rotation.y);
      if (frame && ref) anchorCluster(c, frame, ref, t.newCluster.origin, t.newCluster.yaw);
    }
    if (!c || c.world.get(...t.cell)) return;
    c.world.set(...t.cell, id);
    state.inventory[id]--;
    c.meshes.markDirty();
  }
  renderHotbar();
  persist();
}

/* ------------------------------------------------------------------ HUD */

let toastTimer = 0;
function toast(text: string): void {
  ui.toast.textContent = text;
  ui.toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (ui.toast.hidden = true), 2000);
}

let hintText: string | null = null;
function setHint(text: string | null): void {
  if (text === hintText) return;
  hintText = text;
  ui.hint.hidden = text === null;
  if (text !== null) ui.hint.textContent = text;
}

const slotEls = new Map<BlockId, HTMLButtonElement>();

function buildHotbar(): void {
  BLOCK_IDS.forEach((id, i) => {
    const b = document.createElement('button');
    b.className = 'slot';
    b.style.backgroundImage = `url(${BLOCKS[id].icon})`;
    b.setAttribute('aria-label', BLOCKS[id].label);
    b.innerHTML = `<span class="key">${i + 1}</span><span class="count"></span>`;
    b.addEventListener('click', () => selectBlock(id));
    ui.hotbar.appendChild(b);
    slotEls.set(id, b);
  });
}

function renderHotbar(): void {
  for (const id of BLOCK_IDS) {
    const el = slotEls.get(id)!;
    el.classList.toggle('active', id === state.selected);
    el.classList.toggle('empty', state.inventory[id] <= 0);
    (el.querySelector('.count') as HTMLElement).textContent = String(state.inventory[id]);
  }
  ui.tool.dataset.tool = state.tool;
  ui.tool.innerHTML = state.tool === 'place' ? '🧱<br />وضع' : '⛏<br />تكسير';
}

function selectBlock(id: BlockId): void {
  state.selected = id;
  if (state.tool === 'break') state.tool = 'place';
  renderHotbar();
  persist();
}

function toggleTool(): void {
  state.tool = state.tool === 'place' ? 'break' : 'place';
  renderHotbar();
}

function show(screen: 'home' | 'help' | 'error' | 'confirm' | null): void {
  ui.home.hidden = screen !== 'home';
  ui.help.hidden = screen !== 'help';
  ui.error.hidden = screen !== 'error';
  ui.confirm.hidden = screen !== 'confirm';
}

function showError(message: string): void {
  ui.errorText.textContent = message;
  show('error');
}

/* ------------------------------------------------------------------ modes */

function applySandboxLook(): void {
  scene.background = SKY;
  scene.fog = new THREE.Fog(SKY, 60, 160);
  root.position.set(0, 0, 0);
  root.quaternion.identity();
  root.scale.setScalar(1);
  root.visible = true;
  ground.visible = true;
  arFloor.visible = false;
  reticle.visible = false;
  hemi.visible = true;
  sun.position.copy(SUN_DEFAULT);
  sun.intensity = 2.1;
  sun.color.setHex(0xffffff);
  setShadowBounds(30, 1, 120);
  controls.enabled = true;
}

function enterSandbox(): void {
  state.mode = 'sandbox';
  applySandboxLook();
  ui.crosshair.hidden = true;
  ui.replace.hidden = true;
  ui.features.hidden = true;
  ui.modeLabel.textContent = 'الوضع العادي';
  setHint(state.ar.supported ? null : 'الواقع المعزز غير متاح على هذا الجهاز — أنت في الوضع ثلاثي الأبعاد');
  window.setTimeout(() => state.mode === 'sandbox' && setHint(null), 4500);
  ui.hud.hidden = false;
  show(null);
  renderHotbar();
  onResize();
}

function leaveToMenu(): void {
  state.mode = 'menu';
  ui.hud.hidden = true;
  setHint(null);
  show('home');
}

/* ------------------------------------------------------------------ AR */

interface RealHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  dist: number;
}

const ar = {
  session: null as XRSession | null,
  hitSource: null as XRHitTestSource | null,
  originSet: false,
  rootAnchor: null as XRAnchor | null,
  anchorsWork: false,
  /** Stable plane hit at the screen centre (used to place the first structure). */
  planeHit: null as RealHit | null,
  target: null as BuildTarget | null,
  tapQueued: false,
  featureTimer: 0,
};

const SESSION_FEATURES: XRSessionInit[] = [
  {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay', 'anchors', 'depth-sensing', 'plane-detection', 'light-estimation'],
    domOverlay: { root: ui.root },
    depthSensing: { usagePreference: ['cpu-optimized'], dataFormatPreference: ['luminance-alpha', 'float32'] },
  },
  // Retry without the newer optional features if a browser rejects their configuration.
  { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay', 'anchors'], domOverlay: { root: ui.root } },
];

async function startAR(): Promise<void> {
  if (!navigator.xr) return;
  let session: XRSession | null = null;
  let lastError: unknown = null;
  for (const init of SESSION_FEATURES) {
    try {
      session = await navigator.xr.requestSession('immersive-ar', init);
      break;
    } catch (e) {
      lastError = e;
      if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) break;
    }
  }
  if (!session) {
    console.warn('AR session failed', lastError);
    showError(explainXRError(lastError));
    return;
  }
  try {
    await renderer.xr.setSession(session);
    ar.session = session;
    session.addEventListener('end', onARSessionEnd);
    const viewer = await session.requestReferenceSpace('viewer');
    // Planes only: hands and moving objects never move the target surface.
    ar.hitSource = (await session.requestHitTestSource?.({ space: viewer, entityTypes: ['plane'] })) ?? null;
    depth.start(session);
    void light.start(session);
    enterAR();
  } catch (e) {
    console.warn('AR setup failed', e);
    session.end().catch(() => undefined);
    showError(explainXRError(e));
  }
}

function enterAR(): void {
  state.mode = 'ar';
  controls.enabled = false;
  scene.background = null;
  scene.fog = null;
  ground.visible = false;
  root.scale.setScalar(AR_BLOCK_SIZE);
  root.visible = false; // appears once anchored to a real surface
  setShadowBounds(2.6, 0.05, 10);
  ar.originSet = false;
  ar.rootAnchor = null;
  ar.anchorsWork = false;
  ar.target = null;
  ar.tapQueued = false;
  planes.scanning = true;
  ui.crosshair.hidden = true;
  ui.replace.hidden = true;
  ui.features.hidden = false;
  ui.modeLabel.textContent = 'واقع معزز';
  setHint('حرّك الهاتف ببطء لمسح المكان…');
  ui.hud.hidden = false;
  show(null);
  renderHotbar();
  updateFeatureChip();
  ar.featureTimer = window.setInterval(updateFeatureChip, 1000);
}

function onARSessionEnd(): void {
  window.clearInterval(ar.featureTimer);
  ar.session = null;
  ar.hitSource = null;
  ar.rootAnchor?.delete();
  ar.rootAnchor = null;
  for (const c of state.clusters) {
    c.anchor?.delete();
    c.anchor = null;
  }
  ar.originSet = false;
  ar.target = null;
  depth.stop();
  planes.clear();
  light.stop();
  ghost.visible = false;
  applySandboxLook();
  persist();
  leaveToMenu();
}

function updateFeatureChip(): void {
  const mark = (ok: boolean | undefined) => (ok ? '✓' : ok === false ? '✗' : '…');
  ui.features.textContent = `إخفاء خلف الأجسام ${mark(depth.active || (ar.originSet ? false : undefined))} · أسطح ${mark(
    planes.supported,
  )} · إضاءة ${mark(light.active || undefined)} · تثبيت ${mark(ar.anchorsWork || (ar.originSet ? false : undefined))}`;
}

function anchorCluster(c: Cluster, frame: XRFrame, ref: XRReferenceSpace, origin: THREE.Vector3, yaw: number): void {
  void createAnchor(frame, ref, origin, yaw).then((a) => {
    if (!a) return;
    if (state.clusters.includes(c) && state.mode === 'ar') c.anchor = a;
    else a.delete();
  });
}

function createAnchor(frame: XRFrame, ref: XRReferenceSpace, pos: THREE.Vector3, yaw: number): Promise<XRAnchor | null> {
  if (!frame.createAnchor) return Promise.resolve(null);
  const q = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, yaw);
  try {
    return frame
      .createAnchor(new XRRigidTransform({ x: pos.x, y: pos.y, z: pos.z }, { x: q.x, y: q.y, z: q.z, w: q.w }), ref)
      .then((a) => {
        ar.anchorsWork = true;
        return a;
      })
      .catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

/** Yaw that makes a grid's +z axis face the camera. */
function facingYaw(dir: THREE.Vector3): number {
  return Math.atan2(dir.x, dir.z) + Math.PI;
}

const tmpMatrix = new THREE.Matrix4();

function arFrame(frame: XRFrame): void {
  const ref = renderer.xr.getReferenceSpace();
  if (!ref) return;
  const pose = frame.getViewerPose(ref);
  const view = pose?.views[0];
  if (!view) return;

  const camPos = new THREE.Vector3().setFromMatrixPosition(tmpMatrix.fromArray(view.transform.matrix));
  const camDir = new THREE.Vector3(0, 0, -1).transformDirection(tmpMatrix);

  // 1. Keep every structure locked to its real-world anchor.
  if (ar.rootAnchor) {
    const p = frame.getPose(ar.rootAnchor.anchorSpace, ref);
    if (p) root.position.set(p.transform.position.x, p.transform.position.y, p.transform.position.z);
  }
  root.updateMatrixWorld(true);
  for (const c of state.clusters) {
    if (!c.anchor) continue;
    const p = frame.getPose(c.anchor.anchorSpace, ref);
    if (p) c.group.position.copy(root.worldToLocal(new THREE.Vector3(p.transform.position.x, p.transform.position.y, p.transform.position.z)));
  }

  // 2. Environment understanding.
  const vp = renderer.xr.getCamera().cameras[0]?.viewport;
  depth.update(frame, view, vp ? vp.z : window.innerWidth, vp ? vp.w : window.innerHeight);
  planes.update(frame, ref);
  arFloor.visible = ar.originSet && planes.supported === false;
  if (light.update(frame)) {
    hemi.visible = false;
    sun.color.copy(light.color);
    sun.intensity = Math.min(4, light.intensity * 1.6);
    const target = new THREE.Vector3().setFromMatrixPosition(root.matrixWorld);
    sun.position.copy(root.worldToLocal(target.add(light.direction.clone().multiplyScalar(2.4))));
  }

  // 3. What is the player aiming at?
  ar.planeHit = null;
  if (ar.hitSource) {
    const hp = frame.getHitTestResults(ar.hitSource)[0]?.getPose(ref);
    if (hp) {
      tmpMatrix.fromArray(hp.transform.matrix);
      const point = new THREE.Vector3().setFromMatrixPosition(tmpMatrix);
      const normal = new THREE.Vector3().setFromMatrixColumn(tmpMatrix, 1).normalize();
      ar.planeHit = { point, normal, dist: point.distanceTo(camPos) };
      reticle.matrix.copy(tmpMatrix);
    }
  }

  if (!ar.originSet) {
    const ok = !!ar.planeHit && ar.planeHit.normal.y > 0.85;
    reticle.visible = ok;
    ghost.visible = false;
    setHint(
      ok
        ? 'سطح مستوٍ مكتشف — اضغط لبدء البناء هنا'
        : planes.count > 0
          ? 'وجّه الدائرة نحو سطح أفقي (أرض أو طاولة)'
          : 'حرّك الهاتف ببطء لمسح المكان…',
    );
    if (ar.tapQueued) {
      ar.tapQueued = false;
      if (ok) placeRoot(frame, ref, ar.planeHit!, camDir);
      else toast('لم يُكتشف سطح مستوٍ بعد');
    }
    return;
  }

  reticle.visible = false;
  ar.target = computeARTarget(view, camPos, camDir);
  updateGhost(ar.target);
  if (ar.tapQueued) {
    ar.tapQueued = false;
    commit(ar.target, frame, ref);
  }
}

function placeRoot(frame: XRFrame, ref: XRReferenceSpace, hit: RealHit, camDir: THREE.Vector3): void {
  const yaw = facingYaw(camDir);
  // Centre block (0,0,0) on the aimed point.
  const origin = hit.point.clone().sub(new THREE.Vector3(0.5, 0, 0.5).applyAxisAngle(Y_AXIS, yaw).multiplyScalar(AR_BLOCK_SIZE));
  root.position.copy(origin);
  root.rotation.set(0, yaw, 0);
  root.visible = true;
  ar.originSet = true;
  planes.scanning = false;
  reticle.visible = false;
  ui.crosshair.hidden = false;
  ui.replace.hidden = false;
  setHint(null);
  void createAnchor(frame, ref, origin, yaw).then((a) => {
    if (a && ar.originSet && state.mode === 'ar') ar.rootAnchor = a;
    else a?.delete();
  });
  const first = state.clusters[0];
  if (first.world.size === 0 && state.tool === 'place') commit({ action: 'place', cluster: first, cell: [0, 0, 0] });
  else toast('تم تثبيت بنائك هنا');
}

function computeARTarget(view: XRView, camPos: THREE.Vector3, camDir: THREE.Vector3): BuildTarget | null {
  // Nearest real surface along the aim: detected plane, or any object seen by the depth sensor.
  let real = ar.planeHit;
  const d = depth.depthAt(0.5, 0.5);
  if (d !== null && d > 0.1 && (!real || d < real.dist - 0.05)) {
    const normal = depth.normalAt(view, 0.5, 0.5) ?? camDir.clone().negate();
    real = { point: camPos.clone().addScaledVector(camDir, d), normal, dist: d };
  }

  const vox = castClusters(camPos, camDir, false, 6);
  const voxFirst = !!vox && vox.dist <= (real ? real.dist : Infinity) + 0.02;
  let t: BuildTarget | null;
  if (voxFirst) t = voxelTarget(vox!.cluster, vox!.hit, state.tool);
  else if (state.tool === 'place' && real) t = surfaceTarget(real, camDir);
  else t = null;

  if (t && !t.blocked && t.action === 'place' && cellInsideRealObject(targetCenter(t), view)) {
    t.blocked = 'هذا المكان يشغله جسم حقيقي';
  }
  return t;
}

const AXES = ['x', 'y', 'z'] as const;

/** Target a block resting on a real surface: extend an aligned grid, or start a new one on that surface. */
function surfaceTarget(real: RealHit, camDir: THREE.Vector3): BuildTarget {
  root.updateMatrixWorld(true);
  const byDistance = [...state.clusters].sort(
    (a, b) =>
      a.group.getWorldPosition(new THREE.Vector3()).distanceTo(real.point) -
      b.group.getWorldPosition(new THREE.Vector3()).distanceTo(real.point),
  );
  for (const c of byDistance) {
    inverse.copy(c.group.matrixWorld).invert();
    const p = real.point.clone().applyMatrix4(inverse);
    const n = real.normal.clone().transformDirection(inverse);
    const k = AXES.reduce((best, a) => (Math.abs(n[a]) > Math.abs(n[best]) ? a : best), 'x' as (typeof AXES)[number]);
    if (Math.abs(n[k]) < 0.9) continue;
    const layer = Math.round(p[k]);
    if (Math.abs(p[k] - layer) > FIT_TOLERANCE) continue;
    const cell: Cell = [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)];
    cell[AXES.indexOf(k)] = n[k] > 0 ? layer : layer - 1;
    if (!cellAllowed(c, cell) || c.world.get(...cell)) continue;
    return { action: 'place', cluster: c, cell };
  }

  // No grid lines up with this surface: start a new grid aligned and flush with it.
  const n = real.normal;
  let yaw: number;
  let offset: THREE.Vector3;
  if (Math.abs(n.y) > 0.7) {
    yaw = facingYaw(camDir);
    offset = new THREE.Vector3(0.5, n.y > 0 ? 0 : 1, 0.5);
  } else {
    yaw = Math.atan2(n.x, n.z); // grid +z points out of the wall
    offset = new THREE.Vector3(0.5, 0.5, 0);
  }
  const origin = real.point.clone().sub(offset.applyAxisAngle(Y_AXIS, yaw).multiplyScalar(AR_BLOCK_SIZE));
  const local = root.worldToLocal(origin.clone());
  pendingGroup.position.copy(local);
  pendingGroup.rotation.set(0, yaw - root.rotation.y, 0);
  pendingGroup.updateMatrixWorld(true);
  return { action: 'place', cluster: null, cell: [0, 0, 0], newCluster: { origin, yaw } };
}

/** True when the depth sensor sees a real surface in front of the cell's centre (cell is inside/behind it). */
function cellInsideRealObject(center: THREE.Vector3, view: XRView): boolean {
  if (!depth.active) return false;
  const viewInverse = new THREE.Matrix4().fromArray(view.transform.inverse.matrix);
  const p = center.clone().applyMatrix4(viewInverse);
  if (p.z >= 0) return false;
  const zCenter = -p.z;
  const ndc = p.applyMatrix4(new THREE.Matrix4().fromArray(view.projectionMatrix));
  const realDepth = depth.depthAt((ndc.x + 1) / 2, (1 - ndc.y) / 2);
  return realDepth !== null && realDepth < zCenter - OBSTACLE_MARGIN;
}

function onARSelect(): void {
  if (state.mode === 'ar') ar.tapQueued = true; // resolved inside the next XR frame (depth/anchors need it)
}
renderer.xr.getController(0).addEventListener('select', onARSelect);
scene.add(renderer.xr.getController(0));

function replaceOrigin(): void {
  ar.rootAnchor?.delete();
  ar.rootAnchor = null;
  for (const c of state.clusters) {
    c.anchor?.delete();
    c.anchor = null;
  }
  ar.originSet = false;
  root.visible = false;
  planes.scanning = true;
  ui.crosshair.hidden = true;
  ui.replace.hidden = true;
  ghost.visible = false;
}

/* ------------------------------------------------------------------ sandbox input */

let press: { x: number; y: number; t: number; moved: boolean } | null = null;

canvas.addEventListener('pointerdown', (e) => {
  if (state.mode !== 'sandbox') return;
  if (press) {
    press.moved = true; // second finger => pinch/pan, never a tap
    return;
  }
  press = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
  if (e.pointerType === 'touch') updateGhost(sandboxTarget(e.clientX, e.clientY, state.tool));
});

canvas.addEventListener('pointermove', (e) => {
  if (state.mode !== 'sandbox') return;
  if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) press.moved = true;
  if (e.pointerType === 'mouse' || (press && !press.moved)) updateGhost(sandboxTarget(e.clientX, e.clientY, state.tool));
  else if (press?.moved) ghost.visible = false;
});

canvas.addEventListener('pointerup', (e) => {
  if (state.mode !== 'sandbox') return;
  if (press && !press.moved && performance.now() - press.t < 600) {
    const tool = e.button === 2 ? 'break' : state.tool;
    const t = sandboxTarget(e.clientX, e.clientY, tool);
    if (!t && tool === 'break') toast('الأرضية لا يمكن تكسيرها');
    else commit(t);
    if (e.pointerType === 'mouse') updateGhost(sandboxTarget(e.clientX, e.clientY, state.tool));
  }
  if (e.pointerType !== 'mouse') ghost.visible = false;
  press = null;
});

canvas.addEventListener('pointercancel', () => {
  press = null;
  ghost.visible = false;
});
canvas.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && (ghost.visible = false));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (state.mode === 'menu') return;
  const n = Number(e.key);
  if (n >= 1 && n <= BLOCK_IDS.length) selectBlock(BLOCK_IDS[n - 1]);
  else if (e.key.toLowerCase() === 'q') toggleTool();
});

/* ------------------------------------------------------------------ wiring */

// Taps on HUD controls must not also count as an AR "select" on the world.
for (const el of [ui.hud.querySelector('.topbar'), ui.hud.querySelector('.bottombar'), ui.confirm, ui.error, ui.help, ui.home]) {
  el?.addEventListener('beforexrselect', (e) => e.preventDefault());
}

ui.start.addEventListener('click', () => {
  if (state.ar.supported) void startAR();
  else enterSandbox();
});
ui.sandbox.addEventListener('click', enterSandbox);
$('btn-help').addEventListener('click', () => show('help'));
$('btn-help-close').addEventListener('click', () => show(state.mode === 'menu' ? 'home' : null));
$('btn-error-sandbox').addEventListener('click', enterSandbox);
$('btn-error-close').addEventListener('click', () => show('home'));
$('btn-menu').addEventListener('click', () => {
  if (state.mode === 'ar') void ar.session?.end(); // triggers onARSessionEnd -> menu
  else leaveToMenu();
});
ui.replace.addEventListener('click', replaceOrigin);
ui.tool.addEventListener('click', toggleTool);
$('btn-reset').addEventListener('click', () => show('confirm'));
$('btn-confirm-no').addEventListener('click', () => show(null));
$('btn-confirm-yes').addEventListener('click', () => {
  for (const c of state.clusters.slice(1)) removeCluster(c);
  state.clusters[0].world.clear();
  state.clusters[0].meshes.markDirty();
  state.inventory = defaultInventory();
  clearState();
  renderHotbar();
  show(null);
  toast('تمت إعادة ضبط العالم');
});

function onResize(): void {
  if (renderer.xr.isPresenting) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

/* ------------------------------------------------------------------ boot */

restore();
buildHotbar();
renderHotbar();
applySandboxLook();
onResize();

renderer.setAnimationLoop((_time, frame) => {
  if (state.mode === 'sandbox') controls.update();
  else if (state.mode === 'ar' && frame) arFrame(frame);
  for (const c of state.clusters) c.meshes.flush();
  renderer.render(scene, camera);
});

void detectAR().then((support) => {
  state.ar = support;
  if (support.supported) {
    ui.arStatus.textContent = 'الواقع المعزز متاح على جهازك ✓ (سيُطلب إذن الكاميرا عند البدء)';
    ui.arStatus.classList.add('ok');
    ui.sandbox.hidden = false;
  } else {
    ui.arStatus.textContent = support.reason;
    ui.arStatus.classList.add('warn');
    ui.start.textContent = 'ابدأ اللعب (وضع ثلاثي الأبعاد)';
  }
});

show('home');
