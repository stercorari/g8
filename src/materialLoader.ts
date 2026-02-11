import * as THREE from "three";
import { TextureLoader } from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

/* ------------------------------------------------------------------
   MATERIAL LOADING
------------------------------------------------------------------ */

interface MaterialMapping {
  [key: string]: string; // Material name -> folder path
}

// Map GLTF material names to material folder paths
const materialMappings: MaterialMapping = {
  "14 - Default": "basamento",
  "verde": "verde",
  "tetto": "clay roof",
  "ghiaia": "pavimento ghiaia",
  "intonaco rosa": "plastered wall",
  "intonaco chiaro": "plastered wall",
  "intonaco grigio": "plastered wall",
  "default": "basamento",
  "default1": "basamento",
  "default2": "basamento",
  "default3": "basamento",
  "Material #14": "basamento",
};

const textureLoader = new TextureLoader();
const exrLoader = new EXRLoader();

function loadMaterialTextures(_materialName: string, folderName: string): Promise<{
  map?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  displacementMap?: THREE.Texture;
}> {
  return new Promise((resolve) => {
    const basePath = `${import.meta.env.BASE_URL}materials/${folderName}/`;
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
    
    // Try to load textures based on folder structure
    // Different folders have different naming conventions
    
    if (folderName === "verde") {
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
    } else if (folderName === "plastered wall") {
      total = 3;
      // Use the diff texture (albedo)
      textureLoader.load(`${basePath}plastered_wall_03_diff_2k.jpg`, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.map = tex;
        checkComplete();
      }, undefined, () => checkComplete());
      
      textureLoader.load(`${basePath}plastered_wall_03_rough_2k.jpg`, (tex) => {
        textures.roughnessMap = tex;
        checkComplete();
      }, undefined, () => checkComplete());
      
      textureLoader.load(`${basePath}plastered_wall_03_nor_dx_2k.jpg`, (tex) => {
        textures.normalMap = tex;
        checkComplete();
      }, undefined, () => checkComplete());
    } else if (folderName === "clay roof") {
      total = 3;
      textureLoader.load(`${basePath}textures/clay_roof_tiles_02_diff_2k.jpg`, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.map = tex;
        checkComplete();
      }, undefined, () => checkComplete());
      
      exrLoader.load(`${basePath}textures/clay_roof_tiles_02_rough_2k.exr`, (tex) => {
        textures.roughnessMap = tex;
        checkComplete();
      }, undefined, () => checkComplete());
      
      exrLoader.load(`${basePath}textures/clay_roof_tiles_02_nor_gl_2k.exr`, (tex) => {
        textures.normalMap = tex;
        checkComplete();
      }, undefined, () => checkComplete());
    } else if (folderName === "pavimento ghiaia") {
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
    } else {
      // No textures found for this material
      resolve(textures);
    }
  });
}

export async function applyMaterialsFromFolder(model: THREE.Group): Promise<void> {
  const materialMap = new Map<string, THREE.MeshStandardMaterial>();
  
  // First, collect all unique material names from meshes
  const materialNames = new Set<string>();
  model.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material) {
      const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      if (material.name) {
        materialNames.add(material.name);
      }
    }
  });
  
  console.log(`\n=== LOADING MATERIALS ===`);
  console.log(`Found ${materialNames.size} unique materials`);
  
  // Load textures for each material
  const loadPromises: Promise<void>[] = [];
  
  for (const materialName of materialNames) {
    const folderName = materialMappings[materialName];
    
    if (!folderName) {
      console.log(`⚠️  No mapping found for material: "${materialName}"`);
      continue;
    }
    
    console.log(`📦 Loading textures for "${materialName}" from folder: ${folderName}`);
    
    const loadPromise = loadMaterialTextures(materialName, folderName).then((textures) => {
      const material = new THREE.MeshStandardMaterial({
        name: materialName,
      });
      
      if (textures.map) {
        material.map = textures.map;
        material.map.wrapS = THREE.RepeatWrapping;
        material.map.wrapT = THREE.RepeatWrapping;
      }
      
      if (textures.normalMap) {
        material.normalMap = textures.normalMap;
        material.normalMap.wrapS = THREE.RepeatWrapping;
        material.normalMap.wrapT = THREE.RepeatWrapping;
      }
      
      if (textures.roughnessMap) {
        material.roughnessMap = textures.roughnessMap;
        material.roughnessMap.wrapS = THREE.RepeatWrapping;
        material.roughnessMap.wrapT = THREE.RepeatWrapping;
      }
      
      if (textures.displacementMap) {
        material.displacementMap = textures.displacementMap;
        material.displacementScale = 0.1;
        material.displacementBias = -0.05;
      }
      
      materialMap.set(materialName, material);
      console.log(`✅ Loaded material: "${materialName}"`);
    });
    
    loadPromises.push(loadPromise);
  }
  
  await Promise.all(loadPromises);
  
  // Apply materials to meshes
  console.log(`\n=== APPLYING MATERIALS ===`);
  let appliedCount = 0;
  
  model.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material) {
      const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      if (material.name && materialMap.has(material.name)) {
        obj.material = materialMap.get(material.name)!;
        appliedCount++;
      }
    }
  });
  
  console.log(`✅ Applied materials to ${appliedCount} meshes`);
}

