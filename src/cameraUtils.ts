import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/* ------------------------------------------------------------------
   CAMERA UTILITIES
------------------------------------------------------------------ */

/**
 * Sets up a keyboard shortcut to log the current camera position and target.
 * Press 'P' to capture the camera position.
 * 
 * @param camera - The Three.js camera
 * @param controls - The OrbitControls instance
 */
export function setupCameraPositionLogger(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls
): void {
  const logCameraPosition = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() === 'p' && !event.ctrlKey && !event.metaKey) {
      const pos = camera.position;
      const target = controls.target;
      console.log('\n=== CAMERA POSITION ===');
      console.log('Camera position:');
      console.log(`  x: ${pos.x.toFixed(4)},`);
      console.log(`  y: ${pos.y.toFixed(4)},`);
      console.log(`  z: ${pos.z.toFixed(4)}`);
      console.log('\nControls target:');
      console.log(`  x: ${target.x.toFixed(4)},`);
      console.log(`  y: ${target.y.toFixed(4)},`);
      console.log(`  z: ${target.z.toFixed(4)}`);
      console.log('\nCopy these values and tell me to apply them!');
    }
  };
  
  window.addEventListener('keydown', logCameraPosition);
}
