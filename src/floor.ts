import * as THREE from "three";
import { TextureLoader } from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

/**
 * Floor creation with asphalt material (GLTF optimized)
 */

const textureLoader = new TextureLoader();
const exrLoader = new EXRLoader();

/**
 * Loads asphalt textures (GLTF optimized, 1k resolution)
 */
function loadAsphaltTextures(): Promise<{
  map?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  displacementMap?: THREE.Texture;
}> {
  return new Promise((resolve) => {
    // Use 4k textures from highway folder (better quality than 2k)
    const basePath = `${import.meta.env.BASE_URL}materials/highway/`;
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
      tex.minFilter = THREE.LinearMipmapLinearFilter; // High quality mipmaps
      tex.magFilter = THREE.LinearFilter; // Linear filtering when magnified
      tex.generateMipmaps = true; // Ensure mipmaps are generated
      tex.anisotropy = 16; // Maximum anisotropy for better quality at angles
    };
    
    // Diffuse/albedo texture (4k version)
    textureLoader.load(
      `${basePath}flower_scattered_asphalt_diff_4k.jpg`,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        configureTexture(tex);
        textures.map = tex;
        console.log(`✅ Loaded asphalt diffuse texture (4k)`);
        checkComplete();
      },
      undefined,
      (error) => {
        console.error(`❌ Failed to load asphalt diffuse texture:`, error);
        checkComplete();
      }
    );
    
    // Normal map (EXR format, 4k - much better quality than JPG)
    exrLoader.load(
      `${basePath}flower_scattered_asphalt_nor_gl_4k.exr`,
      (tex) => {
        configureTexture(tex);
        textures.normalMap = tex;
        console.log(`✅ Loaded asphalt normal map (EXR 4k)`);
        checkComplete();
      },
      undefined,
      (error) => {
        console.error(`❌ Failed to load asphalt normal map:`, error);
        checkComplete();
      }
    );
    
    // Roughness map (EXR format, 4k - much better quality than JPG)
    exrLoader.load(
      `${basePath}flower_scattered_asphalt_rough_4k.exr`,
      (tex) => {
        configureTexture(tex);
        textures.roughnessMap = tex;
        console.log(`✅ Loaded asphalt roughness texture (EXR 4k)`);
        checkComplete();
      },
      undefined,
      (error) => {
        console.error(`❌ Failed to load asphalt roughness texture:`, error);
        checkComplete();
      }
    );
    
    // Displacement map (4k PNG)
    textureLoader.load(
      `${basePath}flower_scattered_asphalt_disp_4k.png`,
      (tex) => {
        configureTexture(tex);
        textures.displacementMap = tex;
        console.log(`✅ Loaded asphalt displacement texture (4k)`);
        checkComplete();
      },
      undefined,
      (error) => {
        console.error(`❌ Failed to load asphalt displacement texture:`, error);
        checkComplete();
      }
    );
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
  
  // Load asphalt textures (GLTF optimized)
  const textures = await loadAsphaltTextures();
  
  if (!textures.map) {
    console.error(`❌ Failed to load asphalt textures - floor will use default material`);
    // Create a fallback material so floor still appears
    const fallbackMaterial = new THREE.MeshStandardMaterial({
      name: "floor_asphalt_fallback",
      color: 0x333333, // Dark gray fallback
      roughness: 0.8,
    });
    const floorSize = 10000;
    const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize);
    const floor = new THREE.Mesh(floorGeometry, fallbackMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = positionY;
    floor.receiveShadow = true;
    scene.add(floor);
    return floor;
  }
  
  console.log(`✅ Successfully loaded all asphalt textures`);
  
  // Create floor material
  const floorMaterial = new THREE.MeshStandardMaterial({
    name: "floor_asphalt",
    metalness: 0.0,
    roughness: 0.8, // Default roughness
  });
  
  // Texture repeat - adjust based on desired detail level
  // Lower value = more detail, more repetitions (sharper, smaller texture appearance)
  // Higher value = less detail, fewer repetitions (more stretched/blurry, larger texture appearance)
  // For 4k textures on a large floor, we can use higher repeat since we have more resolution
  const textureRepeat = 25; // Increased to make texture appear smaller/more repeated
  
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
    // ARM texture: roughness is in green channel (Three.js will use it correctly)
    floorMaterial.roughnessMap = textures.roughnessMap;
    floorMaterial.roughnessMap.wrapS = THREE.RepeatWrapping;
    floorMaterial.roughnessMap.wrapT = THREE.RepeatWrapping;
    floorMaterial.roughnessMap.repeat.set(textureRepeat, textureRepeat);
  }
  
  if (textures.displacementMap) {
    floorMaterial.displacementMap = textures.displacementMap;
    floorMaterial.displacementMap.wrapS = THREE.RepeatWrapping;
    floorMaterial.displacementMap.wrapT = THREE.RepeatWrapping;
    floorMaterial.displacementMap.repeat.set(textureRepeat, textureRepeat);
    floorMaterial.displacementScale = 0.1;
    floorMaterial.displacementBias = -0.05;
  }
  
  // Set material properties for better visibility
  floorMaterial.metalness = 0.0;
  floorMaterial.roughness = 0.8; // Default roughness if texture doesn't load
  
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
  console.log(`✅ Floor created with asphalt material (GLTF optimized), size ${floorSize}x${floorSize} at Y=${positionY}, texture repeat: ${textureRepeat}`);
  
  return floor;
}
