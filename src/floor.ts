import * as THREE from "three";
import { TextureLoader } from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

/**
 * Floor creation with material selection
 * Tries to find the best suited material for a floor among available options
 */

const textureLoader = new TextureLoader();
const exrLoader = new EXRLoader();

interface FloorMaterialOption {
  name: string;
  folderName: string;
  description: string;
  priority: number; // Higher priority = better suited for floor
}

// Available floor-appropriate materials, ordered by suitability
const floorMaterialOptions: FloorMaterialOption[] = [
  {
    name: "ghiaia",
    folderName: "pavimento ghiaia",
    description: "Pebble ground - specifically designed for floors",
    priority: 10, // Highest priority - it's literally a floor material
  },
  {
    name: "basamento",
    folderName: "basamento",
    description: "Onyx stone - good for stone floors",
    priority: 8,
  },
  {
    name: "verde",
    folderName: "verde",
    description: "Marble - elegant floor option",
    priority: 7,
  },
];

/**
 * Loads textures for a given material folder
 */
function loadMaterialTextures(folderName: string): Promise<{
  map?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  displacementMap?: THREE.Texture;
}> {
  return new Promise((resolve) => {
    const basePath = `/materials/${folderName}/`;
    const textures: {
      map?: THREE.Texture;
      normalMap?: THREE.Texture;
      roughnessMap?: THREE.Texture;
      displacementMap?: THREE.Texture;
    } = {};
    
    let loaded = 0;
    let total = 0;
    
    const checkComplete = () => {
      loaded++;
      if (loaded >= total) {
        resolve(textures);
      }
    };
    
    if (folderName === "pavimento ghiaia") {
      total = 3;
      textureLoader.load(`${basePath}textures/pebble_ground_01_diff_2k.jpg`, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.map = tex;
        checkComplete();
      }, undefined, () => checkComplete());
      
      textureLoader.load(`${basePath}textures/pebble_ground_01_rough_2k.jpg`, (tex) => {
        textures.roughnessMap = tex;
        checkComplete();
      }, undefined, () => checkComplete());
      
      exrLoader.load(`${basePath}textures/pebble_ground_01_nor_gl_2k.exr`, (tex) => {
        textures.normalMap = tex;
        checkComplete();
      }, undefined, () => checkComplete());
    } else if (folderName === "basamento") {
      total = 3;
      textureLoader.load(`${basePath}Onyx009_2K-JPG_Color.jpg`, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.map = tex;
        checkComplete();
      }, undefined, () => checkComplete());
      
      textureLoader.load(`${basePath}Onyx009_2K-JPG_Roughness.jpg`, (tex) => {
        textures.roughnessMap = tex;
        checkComplete();
      }, undefined, () => checkComplete());
      
      textureLoader.load(`${basePath}Onyx009_2K-JPG_NormalDX.jpg`, (tex) => {
        textures.normalMap = tex;
        checkComplete();
      }, undefined, () => checkComplete());
    } else if (folderName === "verde") {
      total = 3;
      textureLoader.load(`${basePath}Marble009_2K-JPG_Color.jpg`, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.map = tex;
        checkComplete();
      }, undefined, () => checkComplete());
      
      textureLoader.load(`${basePath}Marble009_2K-JPG_Roughness.jpg`, (tex) => {
        textures.roughnessMap = tex;
        checkComplete();
      }, undefined, () => checkComplete());
      
      textureLoader.load(`${basePath}Marble009_2K-JPG_NormalDX.jpg`, (tex) => {
        textures.normalMap = tex;
        checkComplete();
      }, undefined, () => checkComplete());
    } else {
      resolve(textures);
    }
  });
}

/**
 * Finds the best available floor material by trying to load textures
 * Returns the first material that successfully loads
 */
async function findBestFloorMaterial(): Promise<FloorMaterialOption | null> {
  // Sort by priority (highest first)
  const sortedOptions = [...floorMaterialOptions].sort((a, b) => b.priority - a.priority);
  
  for (const option of sortedOptions) {
    try {
      const textures = await loadMaterialTextures(option.folderName);
      // Check if we got at least a diffuse map
      if (textures.map) {
        console.log(`✅ Found suitable floor material: ${option.name} (${option.description})`);
        return option;
      }
    } catch (error) {
      console.warn(`⚠️  Failed to load material "${option.name}":`, error);
      continue;
    }
  }
  
  return null;
}

/**
 * Creates a floor plane with the best available material
 * @param scene - The Three.js scene
 * @param size - Size of the floor (default: 200)
 * @param positionY - Y position of the floor (default: 0)
 * @param preferredMaterial - Optional: prefer a specific material by name
 */
export async function createFloor(
  scene: THREE.Scene,
  size: number = 200,
  positionY: number = 0,
  preferredMaterial?: string
): Promise<THREE.Mesh | null> {
  console.log(`\n=== CREATING FLOOR ===`);
  
  // Find the best material
  let materialOption: FloorMaterialOption | null = null;
  
  if (preferredMaterial) {
    // Try to use preferred material first
    const preferred = floorMaterialOptions.find(opt => opt.name === preferredMaterial);
    if (preferred) {
      const textures = await loadMaterialTextures(preferred.folderName);
      if (textures.map) {
        materialOption = preferred;
        console.log(`✅ Using preferred material: ${preferred.name}`);
      }
    }
  }
  
  // If no preferred or preferred failed, find best available
  if (!materialOption) {
    materialOption = await findBestFloorMaterial();
  }
  
  if (!materialOption) {
    console.error("❌ No suitable floor material found!");
    return null;
  }
  
  // Load textures for the selected material
  const textures = await loadMaterialTextures(materialOption.folderName);
  
  if (!textures.map) {
    console.error(`❌ Failed to load textures for material: ${materialOption.name}`);
    return null;
  }
  
  // Create floor material
  const floorMaterial = new THREE.MeshStandardMaterial({
    name: `floor_${materialOption.name}`,
  });
  
  if (textures.map) {
    floorMaterial.map = textures.map;
    floorMaterial.map.wrapS = THREE.RepeatWrapping;
    floorMaterial.map.wrapT = THREE.RepeatWrapping;
    // Adjust texture repeat based on floor size
    // Smaller repeat value = larger texture pattern
    const repeatValue = size / 10;
    floorMaterial.map.repeat.set(repeatValue, repeatValue);
  }
  
  if (textures.normalMap) {
    floorMaterial.normalMap = textures.normalMap;
    floorMaterial.normalMap.wrapS = THREE.RepeatWrapping;
    floorMaterial.normalMap.wrapT = THREE.RepeatWrapping;
    floorMaterial.normalMap.repeat.set(size / 10, size / 10);
  }
  
  if (textures.roughnessMap) {
    floorMaterial.roughnessMap = textures.roughnessMap;
    floorMaterial.roughnessMap.wrapS = THREE.RepeatWrapping;
    floorMaterial.roughnessMap.wrapT = THREE.RepeatWrapping;
    floorMaterial.roughnessMap.repeat.set(size / 10, size / 10);
  }
  
  if (textures.displacementMap) {
    floorMaterial.displacementMap = textures.displacementMap;
    floorMaterial.displacementScale = 0.1;
    floorMaterial.displacementBias = -0.05;
    floorMaterial.displacementMap.wrapS = THREE.RepeatWrapping;
    floorMaterial.displacementMap.wrapT = THREE.RepeatWrapping;
    floorMaterial.displacementMap.repeat.set(size / 10, size / 10);
  }
  
  // Create floor plane
  const floorGeometry = new THREE.PlaneGeometry(size, size);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  
  // Rotate to lay flat (plane is vertical by default)
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = positionY;
  
  // Receive shadows
  floor.receiveShadow = true;
  
  scene.add(floor);
  console.log(`✅ Floor created with "${materialOption.name}" material, size ${size}x${size} at Y=${positionY}`);
  
  return floor;
}
