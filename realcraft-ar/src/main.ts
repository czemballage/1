import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BLOCKS, BLOCK_IDS, type BlockId } from './blocks';
import { BOUND, MAX_H, VoxelMeshes, VoxelWorld, raycastVoxels, type Hit } from './voxels';
import { clearState, defaultInventory, loadState, saveState } from './storage';
import { detectAR, explainXRError } from './xr';

type Tool = 'place' | 'break';
type Mode = 'menu' | 'sandbox' | 'ar';

/** In AR one block is 10 cm wide. */
const AR_BLOCK_SIZE = 0.1;

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
  replace: $('btn-replace'),
  arStatus: $('ar-status'),
  start: $('btn-start'),
  sandbox: $('btn-sandbox'),
};

/* ------------------------------------------------------------------ state */

const world = new VoxelWorld();
const meshes = new VoxelMeshes(world);
const state = {
  mode: 'menu' as Mode,
  tool: 'place' as Tool,
  selected: 'grass' as BlockId,
  inventory: defaultInventory(),
  ar: { supported: false, reason: '' },
};

function restore(): void {
  const saved = loadState();
  if (!saved) return;
  for (const [x, y, z, i] of saved.blocks) {
    const id = BLOCK_IDS[i];
    if (id && world.inBounds(x, y, z)) world.set(x, y, z, id);
  }
  state.inventory = saved.inventory;
  state.selected = saved.selected;
}

let saveTimer = 0;
function persist(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const blocks: [number, number, number, number][] = [];
    for (const [x, y, z, id] of world.entries()) blocks.push([x, y, z, BLOCK_IDS.indexOf(id)]);
    saveState({ blocks, inventory: state.inventory, selected: state.selected });
  }, 350);
}

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
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 45, 110);

const camera = new THREE.PerspectiveCamera(60, 1, 0.02, 200);
camera.position.set(15, 14, 19);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 2, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.04;
controls.minDistance = 4;
controls.maxDistance = 60;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

/** Everything that belongs to the build lives in this group so AR can place/scale it as one. */
const worldGroup = new THREE.Group();
scene.add(worldGroup);
worldGroup.add(meshes.group);

const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.15);
const sun = new THREE.DirectionalLight(0xffffff, 2.1);
sun.position.set(12, 24, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.bias = -0.0005;
worldGroup.add(hemi, sun, sun.target);

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
setShadowBounds(26, 1, 90);

// Sandbox ground: a checker pattern so the floor is readable.
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
  t.repeat.set(BOUND * 2 / 1, BOUND * 2 / 1);
  return t;
})();
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(BOUND * 2, BOUND * 2).rotateX(-Math.PI / 2),
  new THREE.MeshLambertMaterial({ map: groundTexture }),
);
ground.receiveShadow = true;
worldGroup.add(ground);

// AR floor: invisible except for shadows and a faint grid, so the real surface stays visible.
const arFloor = new THREE.Mesh(
  new THREE.PlaneGeometry(BOUND * 2, BOUND * 2).rotateX(-Math.PI / 2),
  new THREE.ShadowMaterial({ opacity: 0.35 }),
);
arFloor.receiveShadow = true;
arFloor.position.y = 0.002;
const arGrid = new THREE.GridHelper(BOUND * 2, BOUND * 2, 0xffffff, 0xffffff);
(arGrid.material as THREE.LineBasicMaterial).transparent = true;
(arGrid.material as THREE.LineBasicMaterial).opacity = 0.22;
arGrid.position.y = 0.004;
const arFloorGroup = new THREE.Group();
arFloorGroup.add(arFloor, arGrid);
arFloorGroup.visible = false;
worldGroup.add(arFloorGroup);

// Placement ghost: translucent block + outline, drawn in grid space.
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
worldGroup.add(ghost);

// AR reticle (hit-test result on a real surface), in world space.
const reticle = new THREE.Group();
reticle.matrixAutoUpdate = false;
reticle.visible = false;
reticle.add(
  new THREE.Mesh(new THREE.RingGeometry(0.07, 0.09, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x42c28a })),
  new THREE.Mesh(new THREE.CircleGeometry(0.01, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff })),
);
scene.add(reticle);

/* ------------------------------------------------------------------ helpers */

const raycaster = new THREE.Raycaster();
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const inverse = new THREE.Matrix4();

/** Convert a world-space ray into the grid space of worldGroup and traverse the voxels. */
function castGrid(origin: THREE.Vector3, direction: THREE.Vector3): Hit | null {
  worldGroup.updateMatrixWorld(true);
  inverse.copy(worldGroup.matrixWorld).invert();
  const o = tmpA.copy(origin).applyMatrix4(inverse);
  const d = tmpB.copy(origin).add(direction).applyMatrix4(inverse).sub(o).normalize();
  return raycastVoxels(world, o, d);
}

function castFromPointer(clientX: number, clientY: number): Hit | null {
  const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return castGrid(raycaster.ray.origin, raycaster.ray.direction);
}

function castFromScreenCenter(): Hit | null {
  const origin = camera.getWorldPosition(new THREE.Vector3());
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
  return castGrid(origin, direction);
}

let toastTimer = 0;
function toast(text: string): void {
  ui.toast.textContent = text;
  ui.toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (ui.toast.hidden = true), 1800);
}

function setHint(text: string | null): void {
  ui.hint.hidden = text === null;
  if (text !== null) ui.hint.textContent = text;
}

/** In AR, refuse to fill the cell the player's head is in. */
function cellContainsCamera(cell: [number, number, number]): boolean {
  if (state.mode !== 'ar') return false;
  const p = camera.getWorldPosition(new THREE.Vector3());
  worldGroup.updateMatrixWorld(true);
  const local = worldGroup.worldToLocal(p);
  return (
    Math.abs(local.x - (cell[0] + 0.5)) < 0.75 && Math.abs(local.y - (cell[1] + 0.5)) < 0.75 && Math.abs(local.z - (cell[2] + 0.5)) < 0.75
  );
}

/* ------------------------------------------------------------------ gameplay */

function applyTool(hit: Hit | null, tool: Tool): void {
  if (!hit) return;
  if (tool === 'break') {
    if (hit.kind !== 'block' || !hit.cell) {
      toast('الأرضية لا يمكن تكسيرها');
      return;
    }
    const removed = world.delete(...hit.cell);
    if (removed) state.inventory[removed] = Math.min(999, state.inventory[removed] + 1);
  } else {
    const id = state.selected;
    if (!hit.place) return;
    const [x, y, z] = hit.place;
    if (!world.inBounds(x, y, z)) {
      toast(y >= MAX_H ? 'وصلت إلى أقصى ارتفاع' : 'خارج حدود العالم');
      return;
    }
    if (world.get(x, y, z)) return; // overlap guard
    if (state.inventory[id] <= 0) {
      toast(`لا تملك مكعبات ${BLOCKS[id].label} — كسّر بعضها لجمعها`);
      return;
    }
    if (cellContainsCamera(hit.place)) {
      toast('ابتعد قليلًا — المكعب سيظهر داخل الكاميرا');
      return;
    }
    world.set(x, y, z, id);
    state.inventory[id]--;
  }
  meshes.markDirty();
  renderHotbar();
  persist();
}

function updateGhost(hit: Hit | null): void {
  let cell: [number, number, number] | null = null;
  if (state.tool === 'place') {
    if (hit?.place && world.inBounds(...hit.place) && !world.get(...hit.place)) cell = hit.place;
    (ghostFill.material as THREE.MeshBasicMaterial).color.setHex(BLOCKS[state.selected].color);
    (ghostEdges.material as THREE.LineBasicMaterial).color.setHex(0xffffff);
  } else {
    if (hit?.kind === 'block' && hit.cell) cell = hit.cell;
    (ghostFill.material as THREE.MeshBasicMaterial).color.setHex(0xe5604f);
    (ghostEdges.material as THREE.LineBasicMaterial).color.setHex(0xff8a7a);
  }
  ghost.visible = cell !== null;
  if (cell) ghost.position.set(cell[0] + 0.5, cell[1] + 0.5, cell[2] + 0.5);
}

/* ------------------------------------------------------------------ HUD */

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

function resetWorldTransform(): void {
  worldGroup.position.set(0, 0, 0);
  worldGroup.quaternion.identity();
  worldGroup.scale.setScalar(1);
}

function enterSandbox(): void {
  state.mode = 'sandbox';
  scene.background = SKY;
  scene.fog = new THREE.Fog(SKY, 45, 110);
  resetWorldTransform();
  ground.visible = true;
  arFloorGroup.visible = false;
  reticle.visible = false;
  setShadowBounds(26, 1, 90);
  controls.enabled = true;
  ui.crosshair.hidden = true;
  ui.replace.hidden = true;
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

const ar = {
  session: null as XRSession | null,
  hitSource: null as XRHitTestSource | null,
  lastHit: null as XRHitTestResult | null,
  reticleOK: false,
  originSet: false,
  anchor: null as XRAnchor | null,
};

async function startAR(): Promise<void> {
  if (!navigator.xr) return;
  try {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay', 'anchors'],
      domOverlay: { root: ui.root },
    });
    await renderer.xr.setSession(session);
    ar.session = session;
    session.addEventListener('end', onARSessionEnd);
    const viewer = await session.requestReferenceSpace('viewer');
    ar.hitSource = (await session.requestHitTestSource?.({ space: viewer })) ?? null;
    enterAR();
  } catch (e) {
    console.warn('AR session failed', e);
    ar.session?.end().catch(() => undefined);
    showError(explainXRError(e));
  }
}

function enterAR(): void {
  state.mode = 'ar';
  controls.enabled = false;
  scene.background = null;
  scene.fog = null;
  ground.visible = false;
  arFloorGroup.visible = true;
  worldGroup.scale.setScalar(AR_BLOCK_SIZE);
  worldGroup.visible = false; // appears once the player anchors it to a real surface
  setShadowBounds(2.6, 0.1, 8);
  ar.originSet = false;
  ar.anchor = null;
  ar.lastHit = null;
  ui.crosshair.hidden = true;
  ui.replace.hidden = true;
  ui.modeLabel.textContent = 'واقع معزز';
  setHint('حرّك الهاتف ببطء لمسح سطح مستوٍ (طاولة أو أرض)…');
  ui.hud.hidden = false;
  show(null);
  renderHotbar();
}

function onARSessionEnd(): void {
  ar.session = null;
  ar.hitSource = null;
  ar.lastHit = null;
  ar.anchor = null;
  ar.originSet = false;
  worldGroup.visible = true;
  reticle.visible = false;
  resetWorldTransform();
  ghost.visible = false;
  scene.background = SKY;
  scene.fog = new THREE.Fog(SKY, 45, 110);
  ground.visible = true;
  arFloorGroup.visible = false;
  controls.enabled = true;
  leaveToMenu();
}

const reticleMatrix = new THREE.Matrix4();
const up = new THREE.Vector3();

function arFrame(frame: XRFrame): void {
  const refSpace = renderer.xr.getReferenceSpace();
  if (!refSpace) return;

  if (ar.anchor) {
    const pose = frame.getPose(ar.anchor.anchorSpace, refSpace);
    if (pose) worldGroup.position.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
  }

  if (!ar.originSet) {
    ar.reticleOK = false;
    reticle.visible = false;
    ar.lastHit = null;
    if (ar.hitSource) {
      const results = frame.getHitTestResults(ar.hitSource);
      const pose = results[0]?.getPose(refSpace);
      if (pose) {
        reticleMatrix.fromArray(pose.transform.matrix);
        up.setFromMatrixColumn(reticleMatrix, 1);
        // Only accept (near-)horizontal surfaces; the grid is built on a flat floor.
        if (up.y > 0.85) {
          reticle.matrix.copy(reticleMatrix);
          reticle.visible = true;
          ar.reticleOK = true;
          ar.lastHit = results[0];
        }
      }
    }
    setHint(
      ar.reticleOK
        ? 'سطح مناسب! اضغط على الشاشة لتثبيت عالمك هنا'
        : 'حرّك الهاتف ببطء لمسح سطح مستوٍ (طاولة أو أرض)…',
    );
    ghost.visible = false;
  } else {
    updateGhost(castFromScreenCenter());
  }
}

function onARSelect(): void {
  if (state.mode !== 'ar') return;
  if (!ar.originSet) {
    if (!ar.reticleOK) return;
    worldGroup.position.setFromMatrixPosition(reticle.matrix);
    // Face the grid towards the player: snap yaw to the camera heading.
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    worldGroup.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(fwd.x, fwd.z) + Math.PI);
    worldGroup.visible = true;
    ar.originSet = true;
    reticle.visible = false;
    ui.crosshair.hidden = false;
    ui.replace.hidden = false;
    setHint('تم التثبيت! صوّب الـ + نحو المكان واضغط للبناء');
    window.setTimeout(() => ar.originSet && setHint(null), 4000);
    // Anchors keep the world locked to the real surface as tracking refines.
    ar.lastHit
      ?.createAnchor?.()
      .then((a) => (ar.anchor = a))
      .catch(() => undefined);
    return;
  }
  applyTool(castFromScreenCenter(), state.tool);
}

renderer.xr.addEventListener('sessionstart', () => {
  renderer.xr.getController(0).addEventListener('select', onARSelect);
});
// The controller object is stable for the renderer's lifetime; register once.
renderer.xr.getController(0).addEventListener('select', onARSelect);
scene.add(renderer.xr.getController(0));

function replaceOrigin(): void {
  ar.anchor?.delete();
  ar.anchor = null;
  ar.originSet = false;
  ui.crosshair.hidden = true;
  ui.replace.hidden = true;
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
  if (e.pointerType === 'touch') updateGhost(castFromPointer(e.clientX, e.clientY));
});

canvas.addEventListener('pointermove', (e) => {
  if (state.mode !== 'sandbox') return;
  if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) press.moved = true;
  if (e.pointerType === 'mouse' || (press && !press.moved)) updateGhost(castFromPointer(e.clientX, e.clientY));
  else if (press?.moved) ghost.visible = false;
});

canvas.addEventListener('pointerup', (e) => {
  if (state.mode !== 'sandbox') return;
  if (press && !press.moved && performance.now() - press.t < 600) {
    applyTool(castFromPointer(e.clientX, e.clientY), e.button === 2 ? 'break' : state.tool);
    if (e.pointerType === 'mouse') updateGhost(castFromPointer(e.clientX, e.clientY));
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
  world.clear();
  state.inventory = defaultInventory();
  meshes.markDirty();
  clearState();
  renderHotbar();
  show(null);
  toast('تمت إعادة ضبط العالم');
});

function onResize(): void {
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
onResize();

renderer.setAnimationLoop((_time, frame) => {
  if (state.mode === 'sandbox') controls.update();
  else if (state.mode === 'ar' && frame) arFrame(frame);
  meshes.flush();
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
