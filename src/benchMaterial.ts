import * as THREE from "three";
import { TextureLoader } from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

/**
 * Apply wood material to bench mesh inside the temple
 */

const textureLoader = new TextureLoader();
const exrLoader = new EXRLoader();

/**
 * Loads wood textures (GLTF optimized)
 * Expects textures in materials/wood/textures/ folder with GLTF naming convention
 */
function loadWoodTextures(): Promise<{
  map?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  displacementMap?: THREE.Texture;
}> {
  return new Promise((resolve) => {
    const basePath = `${import.meta.env.BASE_URL}materials/wood/textures/`;
    const textures: {
      map?: THREE.Texture;
      normalMap?: THREE.Texture;
      roughnessMap?: THREE.Texture;
      displacementMap?: THREE.Texture;
    } = {};
    
    let loaded = 0;
    const total = 4; // diffuse, normal, roughness, displacement
    
    const checkComplete = () => {
      loaded++;
      if (loaded >= total) {
        resolve(textures);
      }
    };
    
    // Helper function to configure texture for sharp quality
    const configureTexture = (tex: THREE.Texture) => {
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = 16;
    };
    
    // Diffuse/albedo texture (2k version)
    textureLoader.load(
      `${basePath}worn_planks_diff_2k.jpg`,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        configureTexture(tex);
        textures.map = tex;
        console.log(`✅ Loaded wood diffuse texture (2k)`);
        checkComplete();
      },
      undefined,
      (error) => {
        console.error(`❌ Failed to load wood diffuse texture:`, error);
        checkComplete();
      }
    );
    
    // Normal map (EXR format, 2k - much better quality than JPG)
    exrLoader.load(
      `${basePath}worn_planks_nor_gl_2k.exr`,
      (tex) => {
        configureTexture(tex);
        textures.normalMap = tex;
        console.log(`✅ Loaded wood normal map (EXR 2k)`);
        checkComplete();
      },
      undefined,
      (error) => {
        console.error(`❌ Failed to load wood normal map:`, error);
        checkComplete();
      }
    );
    
    // Roughness map (EXR format, 2k - much better quality than JPG)
    exrLoader.load(
      `${basePath}worn_planks_rough_2k.exr`,
      (tex) => {
        configureTexture(tex);
        textures.roughnessMap = tex;
        console.log(`✅ Loaded wood roughness texture (EXR 2k)`);
        checkComplete();
      },
      undefined,
      (error) => {
        console.error(`❌ Failed to load wood roughness texture:`, error);
        checkComplete();
      }
    );
    
    // Displacement map (2k PNG)
    textureLoader.load(
      `${basePath}worn_planks_disp_2k.png`,
      (tex) => {
        configureTexture(tex);
        textures.displacementMap = tex;
        console.log(`✅ Loaded wood displacement texture (2k)`);
        checkComplete();
      },
      undefined,
      (error) => {
        console.error(`❌ Failed to load wood displacement texture:`, error);
        checkComplete();
      }
    );
  });
}

/**
 * Finds bench mesh inside the temple
 * Bench should be on the floor, within the space surrounded by columns and walls
 */
function findBenchMesh(model: THREE.Group, modelCenter: THREE.Vector3, modelSize: THREE.Vector3): THREE.Mesh | null {
  const benchMeshes: Array<{ mesh: THREE.Mesh; distance: number }> = [];
  const box = new THREE.Box3();
  
  // Define the interior space (roughly center area, excluding walls and columns)
  // This is approximate - adjust based on actual temple structure
  const interiorRadius = Math.min(modelSize.x, modelSize.z) * 0.3; // Interior is about 30% of model size
  
  model.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      box.setFromObject(obj);
      const meshCenter = box.getCenter(new THREE.Vector3());
      const meshSize = box.getSize(new THREE.Vector3());
      
      // Check if mesh is:
      // 1. Near the floor (low Y position)
      // 2. Within the interior space (close to model center horizontally)
      // 3. Small enough to be a bench (not a wall or column)
      const horizontalDistance = Math.sqrt(
        Math.pow(meshCenter.x - modelCenter.x, 2) + 
        Math.pow(meshCenter.z - modelCenter.z, 2)
      );
      
      const isNearFloor = meshCenter.y < modelCenter.y - modelSize.y * 0.2; // Below center, near floor
      const isInInterior = horizontalDistance < interiorRadius;
      const isSmallEnough = Math.max(meshSize.x, meshSize.y, meshSize.z) < modelSize.y * 0.3; // Not too large
      const isFlatEnough = meshSize.y < Math.max(meshSize.x, meshSize.z) * 0.5; // Bench-like shape (flat)
      
      if (isNearFloor && isInInterior && isSmallEnough && isFlatEnough) {
        benchMeshes.push({
          mesh: obj,
          distance: horizontalDistance
        });
      }
    }
  });
  
  // Sort by distance from center (closest first) and return the first one
  benchMeshes.sort((a, b) => a.distance - b.distance);
  
  if (benchMeshes.length > 0) {
    console.log(`✅ Found ${benchMeshes.length} potential bench mesh(es), using closest to center`);
    return benchMeshes[0].mesh;
  }
  
  console.log(`⚠️  No bench mesh found, trying alternative search...`);
  
  // Alternative: look for meshes with specific material names that might be the bench
  let benchMesh: THREE.Mesh | null = null;
  model.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material) {
      const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      // Look for materials that might be bench-related
      if (material.name && (
        material.name.toLowerCase().includes('bench') ||
        material.name.toLowerCase().includes('seat') ||
        material.name === 'Material #14' // This might be the bench material
      )) {
        box.setFromObject(obj);
        const meshCenter = box.getCenter(new THREE.Vector3());
        const isNearFloor = meshCenter.y < modelCenter.y;
        if (isNearFloor && !benchMesh) {
          benchMesh = obj;
        }
      }
    }
  });
  
  return benchMesh;
}

/**
 * Applies wood material to the bench mesh
 */
export async function applyWoodMaterialToBench(
  model: THREE.Group,
  modelCenter: THREE.Vector3,
  modelSize: THREE.Vector3
): Promise<void> {
  console.log(`\n=== APPLYING WOOD MATERIAL TO BENCH ===`);
  
  // Find the bench mesh
  const benchMesh = findBenchMesh(model, modelCenter, modelSize);
  
  if (!benchMesh) {
    console.log(`⚠️  Could not find bench mesh, skipping wood material application`);
    return;
  }
  
  console.log(`✅ Found bench mesh: ${benchMesh.name || 'unnamed'}`);
  
  // Load wood textures
  const textures = await loadWoodTextures();
  
  // Create wood material
  const woodMaterial = new THREE.MeshStandardMaterial({
    name: "bench_wood",
    color: 0x8b6f47, // Brown wood color as fallback
    roughness: 0.8,
    metalness: 0.1,
  });
  
  const textureRepeat = 2; // Reasonable repeat for wood texture on bench
  
  if (textures.map) {
    woodMaterial.map = textures.map;
    woodMaterial.map.wrapS = THREE.RepeatWrapping;
    woodMaterial.map.wrapT = THREE.RepeatWrapping;
    woodMaterial.map.repeat.set(textureRepeat, textureRepeat);
  }
  
  if (textures.normalMap) {
    woodMaterial.normalMap = textures.normalMap;
    woodMaterial.normalMap.wrapS = THREE.RepeatWrapping;
    woodMaterial.normalMap.wrapT = THREE.RepeatWrapping;
    woodMaterial.normalMap.repeat.set(textureRepeat, textureRepeat);
  }
  
  if (textures.roughnessMap) {
    woodMaterial.roughnessMap = textures.roughnessMap;
    woodMaterial.roughnessMap.wrapS = THREE.RepeatWrapping;
    woodMaterial.roughnessMap.wrapT = THREE.RepeatWrapping;
    woodMaterial.roughnessMap.repeat.set(textureRepeat, textureRepeat);
  }
  
  if (textures.displacementMap) {
    woodMaterial.displacementMap = textures.displacementMap;
    woodMaterial.displacementMap.wrapS = THREE.RepeatWrapping;
    woodMaterial.displacementMap.wrapT = THREE.RepeatWrapping;
    woodMaterial.displacementMap.repeat.set(textureRepeat, textureRepeat);
    woodMaterial.displacementScale = 0.1;
    woodMaterial.displacementBias = -0.05;
  }
  
  // Apply material to bench
  benchMesh.material = woodMaterial;
  benchMesh.castShadow = true;
  benchMesh.receiveShadow = true;
  
  console.log(`✅ Applied wood material to bench`);
}
