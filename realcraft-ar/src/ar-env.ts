import * as THREE from 'three';

/* ------------------------------------------------------------------ depth occlusion */

const OCCLUSION_FRAGMENT = /* glsl */ `
uniform sampler2D uDepthMap;
uniform float uDepthEnabled;
uniform mat4 uUvTransform;
uniform vec2 uViewport;
varying float vOccDepth;
void occlusionTest() {
  if (uDepthEnabled < 0.5) return;
  // Normalized view coordinates have their origin at the top-left corner.
  vec2 viewUv = gl_FragCoord.xy / uViewport;
  viewUv.y = 1.0 - viewUv.y;
  vec2 depthUv = (uUvTransform * vec4(viewUv, 0.0, 1.0)).xy;
  if (depthUv.x < 0.0 || depthUv.x > 1.0 || depthUv.y < 0.0 || depthUv.y > 1.0) return;
  float realDepth = texture2D(uDepthMap, depthUv).r;
  // Soft edge: blend over ±2.5 cm, resolved with screen-space dithering (no transparency sorting needed).
  float visibility = smoothstep(-0.025, 0.025, realDepth - vOccDepth);
  float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (visibility < noise) discard;
}
`;

/**
 * Real-world occlusion from the WebXR Depth Sensing API (CPU path, as exposed by Chrome on ARCore devices).
 * Every patched material discards fragments that lie behind the real surface seen by the camera,
 * so hands, furniture and other obstacles hide virtual blocks.
 */
export class DepthOcclusion {
  readonly uniforms = {
    uDepthMap: { value: new THREE.DataTexture(new Uint16Array([0]), 1, 1, THREE.RedFormat, THREE.HalfFloatType) as THREE.Texture },
    uDepthEnabled: { value: 0 },
    uUvTransform: { value: new THREE.Matrix4() },
    uViewport: { value: new THREE.Vector2(1, 1) },
  };
  /** True once the session has delivered at least one depth frame. */
  active = false;
  /** Depth information of the current frame; only valid inside the XR frame callback. */
  private info: XRCPUDepthInformation | null = null;
  private texture: THREE.DataTexture | null = null;
  private half: Uint16Array | null = null;
  private format: XRDepthDataFormat | undefined;

  patch(material: THREE.Material): void {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vOccDepth;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvOccDepth = -mvPosition.z;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${OCCLUSION_FRAGMENT}`)
        .replace('void main() {', 'void main() {\n  occlusionTest();');
    };
    material.customProgramCacheKey = () => 'rc-occlusion';
    material.needsUpdate = true;
  }

  start(session: XRSession): void {
    this.format = session.depthDataFormat;
  }

  update(frame: XRFrame, view: XRView, viewportWidth: number, viewportHeight: number): void {
    let info: XRCPUDepthInformation | null | undefined = null;
    try {
      info = frame.getDepthInformation(view);
    } catch {
      info = null; // depth-sensing not enabled for this session
    }
    this.info = info ?? null;
    if (!info) {
      this.uniforms.uDepthEnabled.value = 0;
      return;
    }
    const { width, height } = info;
    if (!this.texture || this.texture.image.width !== width || this.texture.image.height !== height) {
      this.texture?.dispose();
      this.half = new Uint16Array(width * height);
      this.texture = new THREE.DataTexture(this.half, width, height, THREE.RedFormat, THREE.HalfFloatType);
      this.texture.magFilter = THREE.LinearFilter;
      this.texture.minFilter = THREE.LinearFilter;
      this.uniforms.uDepthMap.value = this.texture;
    }
    const src = this.format === 'float32' ? new Float32Array(info.data) : new Uint16Array(info.data);
    const toMeters = info.rawValueToMeters;
    const half = this.half!;
    const n = Math.min(half.length, src.length);
    for (let i = 0; i < n; i++) {
      const m = src[i] * toMeters;
      // 0 = no depth estimate: treat as "far away" so it never hides anything.
      half[i] = THREE.DataUtils.toHalfFloat(m > 0 ? m : 1000);
    }
    this.texture.needsUpdate = true;
    this.uniforms.uUvTransform.value.fromArray(info.normDepthBufferFromNormView.matrix);
    this.uniforms.uViewport.value.set(viewportWidth, viewportHeight);
    this.uniforms.uDepthEnabled.value = 1;
    this.active = true;
  }

  /** Real depth (meters along the view axis) at normalized view coordinates, or null if unknown. */
  depthAt(u: number, v: number): number | null {
    if (!this.info || u < 0 || u > 1 || v < 0 || v > 1) return null;
    try {
      const d = this.info.getDepthInMeters(u, v);
      return d > 0 ? d : null;
    } catch {
      return null;
    }
  }

  /** World-space point seen at normalized view coordinates (u, v). */
  pointAt(view: XRView, u: number, v: number): THREE.Vector3 | null {
    const d = this.depthAt(u, v);
    if (d === null) return null;
    const p = new THREE.Vector3(2 * u - 1, 1 - 2 * v, -1).applyMatrix4(new THREE.Matrix4().fromArray(view.projectionMatrix).invert());
    p.multiplyScalar(d / -p.z);
    return p.applyMatrix4(new THREE.Matrix4().fromArray(view.transform.matrix));
  }

  /** Surface normal (world space, facing the camera) estimated from the depth gradient. */
  normalAt(view: XRView, u: number, v: number): THREE.Vector3 | null {
    const e = 0.03;
    const p0 = this.pointAt(view, u, v);
    const px = this.pointAt(view, u + e, v);
    const py = this.pointAt(view, u, v + e);
    if (!p0 || !px || !py) return null;
    const n = new THREE.Vector3().crossVectors(px.sub(p0), py.sub(p0));
    if (n.lengthSq() < 1e-10) return null;
    n.normalize();
    const cam = view.transform.position;
    if (n.dot(new THREE.Vector3(cam.x - p0.x, cam.y - p0.y, cam.z - p0.z)) < 0) n.negate();
    return n;
  }

  stop(): void {
    this.info = null;
    this.active = false;
    this.uniforms.uDepthEnabled.value = 0;
  }
}

/* ------------------------------------------------------------------ plane detection */

/**
 * Real surfaces from the WebXR Plane Detection API. While scanning they are drawn as a faint overlay so the
 * player sees what the device understands; afterwards they are invisible shadow receivers, so blocks cast
 * shadows onto real tables and floors.
 */
export class RealPlanes {
  readonly group = new THREE.Group();
  readonly scanMaterial = new THREE.MeshBasicMaterial({
    color: 0x42c28a,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  readonly shadowMaterial = new THREE.ShadowMaterial({ opacity: 0.4, side: THREE.DoubleSide });
  scanning = true;
  /** undefined until the first frame tells us whether plane detection is available. */
  supported: boolean | undefined;
  private entries = new Map<XRPlane, { mesh: THREE.Mesh; changed: number }>();

  get count(): number {
    return this.entries.size;
  }

  update(frame: XRFrame, ref: XRReferenceSpace): void {
    let planes: XRPlaneSet | undefined;
    try {
      planes = frame.detectedPlanes;
    } catch {
      planes = undefined;
    }
    this.supported = planes !== undefined;
    if (!planes) return;

    for (const [plane, entry] of this.entries) {
      if (!planes.has(plane)) {
        this.group.remove(entry.mesh);
        entry.mesh.geometry.dispose();
        this.entries.delete(plane);
      }
    }
    for (const plane of planes) {
      let entry = this.entries.get(plane);
      if (!entry) {
        const mesh = new THREE.Mesh(planeGeometry(plane.polygon), this.scanMaterial);
        mesh.matrixAutoUpdate = false;
        mesh.receiveShadow = true;
        this.group.add(mesh);
        entry = { mesh, changed: plane.lastChangedTime };
        this.entries.set(plane, entry);
      } else if (entry.changed !== plane.lastChangedTime) {
        entry.mesh.geometry.dispose();
        entry.mesh.geometry = planeGeometry(plane.polygon);
        entry.changed = plane.lastChangedTime;
      }
      const pose = frame.getPose(plane.planeSpace, ref);
      entry.mesh.visible = !!pose;
      if (pose) entry.mesh.matrix.fromArray(pose.transform.matrix);
      entry.mesh.material = this.scanning ? this.scanMaterial : this.shadowMaterial;
    }
  }

  clear(): void {
    for (const { mesh } of this.entries.values()) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    this.entries.clear();
    this.supported = undefined;
    this.scanning = true;
  }
}

function planeGeometry(polygon: DOMPointReadOnly[]): THREE.BufferGeometry {
  // The polygon lies in the plane's x/z axes (y is the plane normal).
  const shape = new THREE.Shape(polygon.map((p) => new THREE.Vector2(p.x, p.z)));
  return new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2);
}

/* ------------------------------------------------------------------ light estimation */

// WebXR Lighting Estimation (https://immersive-web.github.io/lighting-estimation/) is not in @types/webxr.
interface XRLightProbeLike extends EventTarget {
  readonly probeSpace: XRSpace;
}
interface XRLightEstimateLike {
  readonly sphericalHarmonicsCoefficients: Float32Array;
  readonly primaryLightDirection: DOMPointReadOnly;
  readonly primaryLightIntensity: DOMPointReadOnly;
}
type SessionWithLight = XRSession & { requestLightProbe?: () => Promise<XRLightProbeLike> };
type FrameWithLight = XRFrame & { getLightEstimate?: (probe: XRLightProbeLike) => XRLightEstimateLike | null };

/** Real-world lighting: ambient spherical harmonics + primary light direction/intensity. */
export class LightEstimator {
  readonly probe = new THREE.LightProbe(undefined, 0);
  readonly direction = new THREE.Vector3(0.4, 1, 0.3).normalize();
  readonly color = new THREE.Color(1, 1, 1);
  intensity = 0;
  active = false;
  private xrProbe: XRLightProbeLike | null = null;

  async start(session: XRSession): Promise<void> {
    const s = session as SessionWithLight;
    if (!s.requestLightProbe) return;
    try {
      this.xrProbe = await s.requestLightProbe();
    } catch {
      this.xrProbe = null; // light-estimation not granted
    }
  }

  update(frame: XRFrame): boolean {
    const f = frame as FrameWithLight;
    if (!this.xrProbe || !f.getLightEstimate) return false;
    const estimate = f.getLightEstimate(this.xrProbe);
    if (!estimate) return false;
    this.probe.sh.fromArray(Array.from(estimate.sphericalHarmonicsCoefficients));
    this.probe.intensity = 1;
    const i = estimate.primaryLightIntensity;
    const scale = Math.max(1, i.x, i.y, i.z);
    this.color.setRGB(i.x / scale, i.y / scale, i.z / scale);
    this.intensity = scale;
    const d = estimate.primaryLightDirection;
    this.direction.set(d.x, d.y, d.z);
    if (this.direction.lengthSq() < 1e-6 || this.direction.y < 0.05) this.direction.set(0.4, 1, 0.3);
    this.direction.normalize();
    this.active = true;
    return true;
  }

  stop(): void {
    this.xrProbe = null;
    this.active = false;
    this.probe.intensity = 0;
  }
}
