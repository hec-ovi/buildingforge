import { AmbientLight, DirectionalLight, HemisphereLight, PMREMGenerator, type Scene, type WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** Neutral reflections and low-angle lights for inspecting vertical PBR surfaces. */
export function lightPreview(scene: Scene, renderer: WebGLRenderer): void {
  const environment = new RoomEnvironment();
  const generator = new PMREMGenerator(renderer);
  scene.environment = generator.fromScene(environment, 0.04).texture;
  scene.environmentIntensity = 0.6;
  environment.dispose();
  generator.dispose();

  scene.add(new AmbientLight(0xffffff, 0.35));
  scene.add(new HemisphereLight(0x9fb8d8, 0x2a2a30, 0.85));
  const sun = new DirectionalLight(0xffffff, 2.4);
  sun.position.set(90, 45, 60);
  scene.add(sun);
  const fill = new DirectionalLight(0x8090b0, 1.1);
  fill.position.set(-70, 25, -60);
  scene.add(fill);
}
