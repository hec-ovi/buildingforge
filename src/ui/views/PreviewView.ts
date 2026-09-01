// Three.js orbit viewer for one generated building: the textured GLB as it
// ships, a flat kind-coloured look for reading geometry, a global clip plane for
// floor inspection, and opening highlight boxes from the blueprint.

import {
  ACESFilmicToneMapping, AmbientLight, Box3, BoxGeometry, Color, DirectionalLight, EdgesGeometry,
  GridHelper, Group, HemisphereLight, LineBasicMaterial, LineSegments, Material, Mesh,
  MeshStandardMaterial, PerspectiveCamera, Plane, Scene, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { flatMaterialFor } from './flatMaterials.ts';
import { edgeDir, edgeNormal, type P2 } from '../../core/polygon.ts';
import type { Blueprint } from '../../types.ts';

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
  private flat = false;
  /** shipped material and inspection material per mesh, so the toggle is lossless */
  private readonly looks = new Map<Mesh, { textured: Material; flat: Material }>();

  constructor(container: HTMLElement) {
    this.root = container;
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.clippingPlanes = [this.clipPlane];
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.scene.background = new Color(0x101014);
    this.camera = new PerspectiveCamera(55, 1, 0.1, 2000);
    this.camera.position.set(50, 40, 50);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    container.appendChild(this.renderer.domElement);

    // Facades are vertical, so the key light sits low: an overhead sun lights the
    // slabs and leaves the walls black.
    this.scene.add(new AmbientLight(0xffffff, 0.3));
    this.scene.add(new HemisphereLight(0x9fb8d8, 0x2a2a30, 0.8));
    const sun = new DirectionalLight(0xffffff, 2.4);
    sun.position.set(90, 45, 60);
    this.scene.add(sun);
    // Fill from the opposite quadrant so shadow-side facades keep readable shading.
    const fill = new DirectionalLight(0x8090b0, 1.1);
    fill.position.set(-70, 25, -60);
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
    this.looks.clear();
    this.building.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      const textured = obj.material as Material;
      this.looks.set(obj, { textured, flat: flatMaterialFor(textured.name) });
    });
    this.applyLook();
    this.scene.add(this.building);

    this.highlights = buildHighlights(blueprint);
    this.highlights.visible = this.highlightOn;
    this.scene.add(this.highlights);

    this.buildingTop = blueprint.bounds.height;
    const box = new Box3().setFromObject(this.building);
    const center = box.getCenter(new Vector3());
    this.controls.target.copy(center);
    // Stand outside the bounding sphere and fit it in the field of view, so the
    // first look is the whole building from the street side, never from inside it.
    const radius = box.getSize(new Vector3()).length() / 2;
    const distance = (radius / Math.sin((this.camera.fov * Math.PI) / 360)) * 1.1;
    const eye = new Vector3(1, 0.55, 1).normalize().multiplyScalar(distance);
    this.camera.position.copy(center).add(eye);
  }

  setClip(fraction: number): void {
    this.clipPlane.constant = Math.max(0.5, this.buildingTop * fraction + 0.01);
  }

  setWireframe(on: boolean): void {
    this.wireframe = on;
    this.applyLook();
  }

  /** Flat kind colours instead of the shipped textures, for reading geometry. */
  setFlat(on: boolean): void {
    this.flat = on;
    this.applyLook();
  }

  private applyLook(): void {
    for (const [mesh, look] of this.looks) {
      const material = this.flat ? look.flat : look.textured;
      (material as MeshStandardMaterial).wireframe = this.wireframe;
      mesh.material = material;
    }
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
