import * as THREE from "three";
import { TextureLoader } from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

/**
 * Floor creation with highway material
 */

const textureLoader = new TextureLoader();
const exrLoader = new EXRLoader();

/**
 * Loads highway textures
 */
function loadHighwayTextures(): Promise<{
  map?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  displacementMap?: THREE.Texture;
}> {
  return new Promise((resolve) => {
    const basePath = `${import.meta.env.BASE_URL}materials/highway/`;
    const textures: {
      map?: THREE.Texture;
      normalMap?: THREE.Texture;
      roughnessMap?: THREE.Texture;
      displacementMap?: THREE.Texture;
    } = {};
    
    let loaded = 0;
    const total = 4;
    
    const checkComplete = () => {
      loaded++;
      if (loaded >= total) {
        resolve(textures);
      }
    };
    
    textureLoader.load(`${basePath}flower_scattered_asphalt_diff_4k.jpg`, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      textures.map = tex;
      checkComplete();
    }, undefined, () => checkComplete());
    
    exrLoader.load(`${basePath}flower_scattered_asphalt_rough_4k.exr`, (tex) => {
      textures.roughnessMap = tex;
      checkComplete();
    }, undefined, () => checkComplete());
    
    exrLoader.load(`${basePath}flower_scattered_asphalt_nor_gl_4k.exr`, (tex) => {
      textures.normalMap = tex;
      checkComplete();
    }, undefined, () => checkComplete());
    
    textureLoader.load(`${basePath}flower_scattered_asphalt_disp_4k.png`, (tex) => {
      textures.displacementMap = tex;
      checkComplete();
    }, undefined, () => checkComplete());
  });
}

/**
 * Creates a floor plane with highway material
 * @param scene - The Three.js scene
 * @param size - Size of the floor (default: 200) - ignored, floor is now effectively infinite
 * @param positionY - Y position of the floor (default: 0)
 */
export async function createFloor(
  scene: THREE.Scene,
  _size: number = 200,
  positionY: number = 0
): Promise<THREE.Mesh | null> {
  console.log(`\n=== CREATING FLOOR ===`);
  
  // Load highway textures
  const textures = await loadHighwayTextures();
  
  if (!textures.map) {
    console.error(`❌ Failed to load highway textures`);
    return null;
  }
  
  // Create floor material
  const floorMaterial = new THREE.MeshStandardMaterial({
    name: "floor_highway",
  });
  
  // Large texture repeat value - makes texture appear larger and repeat less
  // Higher value = larger texture appearance, fewer repetitions
  const textureRepeat = 50; // Fixed large value for bigger texture appearance
  
  if (textures.map) {
    floorMaterial.map = textures.map;
    floorMaterial.map.wrapS = THREE.RepeatWrapping;
    floorMaterial.map.wrapT = THREE.RepeatWrapping;
    floorMaterial.map.repeat.set(textureRepeat, textureRepeat);
  }
  
  if (textures.normalMap) {
    floorMaterial.normalMap = textures.normalMap;
    floorMaterial.normalMap.wrapS = THREE.RepeatWrapping;
    floorMaterial.normalMap.wrapT = THREE.RepeatWrapping;
    floorMaterial.normalMap.repeat.set(textureRepeat, textureRepeat);
  }
  
  if (textures.roughnessMap) {
    floorMaterial.roughnessMap = textures.roughnessMap;
    floorMaterial.roughnessMap.wrapS = THREE.RepeatWrapping;
    floorMaterial.roughnessMap.wrapT = THREE.RepeatWrapping;
    floorMaterial.roughnessMap.repeat.set(textureRepeat, textureRepeat);
  }
  
  if (textures.displacementMap) {
    floorMaterial.displacementMap = textures.displacementMap;
    floorMaterial.displacementScale = 0.1;
    floorMaterial.displacementBias = -0.05;
    floorMaterial.displacementMap.wrapS = THREE.RepeatWrapping;
    floorMaterial.displacementMap.wrapT = THREE.RepeatWrapping;
    floorMaterial.displacementMap.repeat.set(textureRepeat, textureRepeat);
  }
  
  // Create a very large floor plane (effectively infinite for practical purposes)
  const floorSize = 10000; // Very large size to appear infinite
  const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  
  // Rotate to lay flat (plane is vertical by default)
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = positionY;
  
  // Receive shadows
  floor.receiveShadow = true;
  
  scene.add(floor);
  console.log(`✅ Floor created with highway material, size ${floorSize}x${floorSize} at Y=${positionY}, texture repeat: ${textureRepeat}`);
  
  return floor;
}
