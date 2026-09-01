// Three.js orbit viewer for one generated building: kind-colored materials
// (no textures until the materials layer), global clip plane for floor
// inspection, opening highlight boxes from the blueprint.

import {
  AmbientLight, Box3, BoxGeometry, Color, DirectionalLight, EdgesGeometry, GridHelper, Group,
  LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, PerspectiveCamera, Plane,
  Scene, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { edgeDir, edgeNormal, type P2 } from '../../core/polygon.ts';
import type { Blueprint } from '../../types.ts';

const KIND_COLORS: Record<string, { color: number; opacity?: number }> = {
  'wall': { color: 0x8a8a92 },
  'wall-trim': { color: 0x6a6a74 },
  'column': { color: 0x74747e },
  'window-glass': { color: 0x6fc3df, opacity: 0.45 },
  'window-frame': { color: 0x3a3a44 },
  'curtain': { color: 0xd8cfa8 },
  'door': { color: 0x5a4a3a },
  'door-glass': { color: 0x9fd8ef, opacity: 0.5 },
  'balcony-slab': { color: 0x7e7e88 },
  'balcony-rail': { color: 0x4a4a54 },
  'roof': { color: 0x55555e },
  'floor-slab': { color: 0x63636d },
  'parapet': { color: 0x77777f },
  'signage': { color: 0xffcf5a },
  'ad-screen': { color: 0x64e0ff },
  'light-fixture': { color: 0xfff0c0 },
  'fire-escape': { color: 0x40342c },
  'aperture-frame': { color: 0xc06040 },
  'roof-artifact': { color: 0x60606a },
};

export class PreviewView {
  readonly root: HTMLElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly clipPlane = new Plane(new Vector3(0, -1, 0), 1000);
  private building: Group | null = null;
  private highlights: Group | null = null;
  private buildingTop = 50;
  private wireframe = false;
  private highlightOn = false;

  constructor(container: HTMLElement) {
    this.root = container;
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.clippingPlanes = [this.clipPlane];
    this.scene.background = new Color(0x101014);
    this.camera = new PerspectiveCamera(55, 1, 0.1, 2000);
    this.camera.position.set(50, 40, 50);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    container.appendChild(this.renderer.domElement);

    this.scene.add(new AmbientLight(0xffffff, 0.55));
    const sun = new DirectionalLight(0xffffff, 1.5);
    sun.position.set(60, 100, 40);
    this.scene.add(sun);
    // Fill from the opposite quadrant so shadow-side facades keep readable shading.
    const fill = new DirectionalLight(0x8090b0, 0.7);
    fill.position.set(-50, 40, -70);
    this.scene.add(fill);
    const grid = new GridHelper(200, 40, 0x2a2a34, 0x1c1c24);
    this.scene.add(grid);

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(container);
    resize();

    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  async showBuilding(glb: Uint8Array, blueprint: Blueprint): Promise<void> {
    if (this.building) { this.scene.remove(this.building); this.building = null; }
    if (this.highlights) { this.scene.remove(this.highlights); this.highlights = null; }

    const gltf = await new GLTFLoader().parseAsync(
      glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer, '');
    this.building = gltf.scene;
    this.building.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      const name: string = (obj.material as { name?: string }).name ?? '';
      const kind = name.split('/')[1] ?? 'wall';
      const spec = KIND_COLORS[kind] ?? { color: 0xff00ff };
      obj.material = new MeshStandardMaterial({
        color: spec.color,
        transparent: spec.opacity !== undefined,
        opacity: spec.opacity ?? 1,
        wireframe: this.wireframe,
        metalness: 0.1,
        roughness: 0.85,
      });
    });
    this.scene.add(this.building);

    this.highlights = buildHighlights(blueprint);
    this.highlights.visible = this.highlightOn;
    this.scene.add(this.highlights);

    this.buildingTop = blueprint.bounds.height;
    const box = new Box3().setFromObject(this.building);
    const center = box.getCenter(new Vector3());
    this.controls.target.copy(center);
    const radius = Math.max(box.getSize(new Vector3()).length() * 0.6, 20);
    this.camera.position.set(center.x + radius, center.y + radius * 0.7, center.z + radius);
  }

  setClip(fraction: number): void {
    this.clipPlane.constant = Math.max(0.5, this.buildingTop * fraction + 0.01);
  }

  setWireframe(on: boolean): void {
    this.wireframe = on;
    this.building?.traverse((obj) => {
      if (obj instanceof Mesh) (obj.material as MeshStandardMaterial).wireframe = on;
    });
  }

  setHighlight(on: boolean): void {
    this.highlightOn = on;
    if (this.highlights) this.highlights.visible = on;
  }
}

function buildHighlights(bp: Blueprint): Group {
  const group = new Group();
  const mat = new LineBasicMaterial({ color: 0xff4fd8 });
  for (const floor of bp.floors) {
    for (const o of floor.openings) {
      const [vx, vz] = floor.outline[o.edge] as P2;
      const d = edgeDir(floor.outline, o.edge);
      const n = edgeNormal(floor.outline, o.edge);
      const uc = o.offset + o.width / 2;
      const y = floor.elevation + o.sill + o.height / 2;
      const geo = new EdgesGeometry(new BoxGeometry(o.width, o.height, 0.3));
      const line = new LineSegments(geo, mat);
      line.position.set(vx + d[0] * uc + n[0] * 0.1, y, vz + d[1] * uc + n[1] * 0.1);
      line.rotation.y = Math.atan2(d[1], -d[0]) + Math.PI;
      group.add(line);
    }
  }
  return group;
}
