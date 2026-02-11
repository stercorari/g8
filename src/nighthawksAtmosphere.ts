import * as THREE from "three";

/**
 * Nighthawks-inspired lighting
 * Creates moody, high-contrast lighting inspired by Hopper's "Nighthawks"
 * - Very dark ambient (deep shadows)
 * - Warm golden interior light (like diner windows)
 * - Cool blue exterior light (street/moonlight)
 * - High contrast between lit and shadow areas
 */

/**
 * Adjusts scene lighting to match Nighthawks atmosphere
 * Characteristic features:
 * - Very dark ambient (almost black shadows)
 * - Warm, golden key light (diner interior glow)
 * - Cool, bluish fill light (street lighting)
 * - High contrast, dramatic shadows
 */
export function setupNighthawksLighting(scene: THREE.Scene): {
  ambient: THREE.AmbientLight;
  keyLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
} {
  // Remove only the basic ambient and directional lights (not spot lights, point lights, or other special lights)
  const lightsToRemove: THREE.Light[] = [];
  scene.traverse((obj) => {
    if (obj instanceof THREE.AmbientLight || obj instanceof THREE.DirectionalLight) {
      // Don't remove SpotLight or PointLight (they're used for special effects)
      if (!(obj instanceof THREE.SpotLight) && !(obj instanceof THREE.PointLight)) {
        lightsToRemove.push(obj);
      }
    }
  });
  lightsToRemove.forEach(light => scene.remove(light));
  
  // Very dark ambient light - creates deep shadows like Nighthawks
  // Dark blue-grey, very low intensity for moody atmosphere
  const ambient = new THREE.AmbientLight(0x2a2a3a, 0.15); // Much darker, lower intensity
  
  // Warm golden key light (like diner interior light spilling out)
  // Nighthawks has warm, almost orange-yellow interior lighting
  const keyLight = new THREE.DirectionalLight(0xffd89b, 3.5); // Warmer, more golden, brighter
  keyLight.position.set(5, 8, 5);
  keyLight.castShadow = true;
  
  // Configure shadows for dramatic effect
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 500;
  keyLight.shadow.bias = -0.0001;
  
  // Set shadow camera bounds to cover a large area (adjust based on scene size)
  // These bounds define the orthographic camera frustum for directional light shadows
  keyLight.shadow.camera.left = -100;
  keyLight.shadow.camera.right = 100;
  keyLight.shadow.camera.top = 100;
  keyLight.shadow.camera.bottom = -100;
  
  // Update the shadow camera matrix
  keyLight.shadow.camera.updateProjectionMatrix();
  
  // Cool blue fill light (like street lighting or moonlight)
  // Nighthawks has cool, bluish exterior lighting contrasting with warm interior
  const fillLight = new THREE.DirectionalLight(0x6b7a8f, 0.8); // Cooler, bluer, slightly brighter
  fillLight.position.set(-5, 4, -5);
  
  scene.add(ambient);
  scene.add(keyLight);
  scene.add(fillLight);
  
  return { ambient, keyLight, fillLight };
}

