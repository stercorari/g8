import * as THREE from "three";
import { FontLoader, Font } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { TextureLoader } from "three";

/**
 * Creates 3D bold text positioned on the floor beside the temple
 */

const fontLoader = new FontLoader();
const textureLoader = new TextureLoader();

/**
 * Loads plastered wall textures (same as temple walls)
 */
function loadPlasteredWallTextures(): Promise<{
  map?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
}> {
  return new Promise((resolve) => {
    const basePath = `${import.meta.env.BASE_URL}materials/plastered wall/`;
    const textures: {
      map?: THREE.Texture;
      normalMap?: THREE.Texture;
      roughnessMap?: THREE.Texture;
    } = {};
    
    let loaded = 0;
    const total = 3;
    
    const checkComplete = () => {
      loaded++;
      if (loaded >= total) {
        resolve(textures);
      }
    };
    
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
  });
}

/**
 * Loads a font file and creates 3D text
 * @param scene - The Three.js scene
 * @param modelBounds - Bounding box of the temple model
 * @param floorY - Y position of the floor
 */
export async function createFloorText(
  scene: THREE.Scene,
  modelBounds: THREE.Box3,
  floorY: number
): Promise<void> {
  console.log(`\n=== CREATING FLOOR TEXT ===`);

  // Calculate position beside the temple
  const modelSize = modelBounds.getSize(new THREE.Vector3());
  const modelCenter = modelBounds.getCenter(new THREE.Vector3());
  
  // Position text to the front of the temple (counter-clockwise from right side)
  // Offset by half the model depth plus some spacing
  const textOffsetZ = modelSize.z * 0.5 + 1;
  const textPosition = new THREE.Vector3(
    modelCenter.x - modelSize.x,
    floorY + 0.1, // Slightly above floor to avoid z-fighting
    modelCenter.z + textOffsetZ
  );

  // Try to load a font - we'll use a fallback approach
  // First, try to load helvetiker font (commonly available)
  const fontUrl = `${import.meta.env.BASE_URL}fonts/helvetiker_bold.typeface.json`;
  
  try {
    const font = await new Promise<Font>((resolve, reject) => {
      fontLoader.load(
        fontUrl,
        (font) => resolve(font),
        undefined,
        () => {
          // If font file doesn't exist, create text using a simpler method
          console.warn(`⚠️  Font file not found at ${fontUrl}, using fallback method`);
          reject(new Error("Font not found"));
        }
      );
    });

    // Create text with loaded font
    await createTextWithFont(scene, font, textPosition);
  } catch (error) {
    // Fallback: create text using shapes (simpler but still works)
    console.log("Using fallback text creation method");
    await createTextWithShapes(scene, textPosition);
  }
}

/**
 * Creates 3D text using TextGeometry with a loaded font
 */
async function createTextWithFont(
  scene: THREE.Scene,
  font: Font,
  position: THREE.Vector3
): Promise<void> {
  const text = "QUANDO\nERAVAMO\nANCORA\nINSIEME";
  const words = text.split("\n");

  const textGroup = new THREE.Group();
  
  // Load plastered wall textures (same as temple walls)
  const wallTextures = await loadPlasteredWallTextures();
  
  // Material for the text - using plastered wall material
  const textMaterial = new THREE.MeshStandardMaterial({
    metalness: 0.1,
    roughness: 0.7,
  });
  
  // Apply wall textures
  if (wallTextures.map) {
    textMaterial.map = wallTextures.map;
    textMaterial.map.wrapS = THREE.RepeatWrapping;
    textMaterial.map.wrapT = THREE.RepeatWrapping;
    // Scale texture to fit text nicely
    textMaterial.map.repeat.set(0.5, 0.5);
  }
  
  if (wallTextures.normalMap) {
    textMaterial.normalMap = wallTextures.normalMap;
    textMaterial.normalMap.wrapS = THREE.RepeatWrapping;
    textMaterial.normalMap.wrapT = THREE.RepeatWrapping;
    textMaterial.normalMap.repeat.set(0.5, 0.5);
  }
  
  if (wallTextures.roughnessMap) {
    textMaterial.roughnessMap = wallTextures.roughnessMap;
    textMaterial.roughnessMap.wrapS = THREE.RepeatWrapping;
    textMaterial.roughnessMap.wrapT = THREE.RepeatWrapping;
    textMaterial.roughnessMap.repeat.set(0.5, 0.5);
  }

  let currentY = 0;
  const lineHeight = -4.2; // Increased line height (negative because Y goes down)
  const fontSize = 4.0;

  // Create each word as separate text geometry
  for (const word of words) {
    const geometry = new TextGeometry(word, {
      font: font,
      size: fontSize,
      height: 0.3, // Bold depth
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelOffset: 0,
      bevelSegments: 5,
    });

    geometry.computeBoundingBox();
    const textMesh = new THREE.Mesh(geometry, textMaterial);
    
    // Left-align each word
    if (geometry.boundingBox) {
      textMesh.position.x = -geometry.boundingBox.min.x;
    }
    
    textMesh.position.y = currentY;
    textMesh.castShadow = true;
    textMesh.receiveShadow = true;
    
    textGroup.add(textMesh);
    currentY += lineHeight;
  }

  // Position the group
  textGroup.position.copy(position);
  
  // Rotate to lay flat on the floor
  textGroup.rotation.x = -Math.PI / 2;
  // Rotate 20 degrees around Y axis
  textGroup.rotation.z = -20 * Math.PI / 180;
  
  scene.add(textGroup);
  console.log(`✅ Floor text created at position (${position.x}, ${position.y}, ${position.z})`);
}

/**
 * Fallback: Creates text using shapes (if font file is not available)
 * This creates simpler 3D text using extruded shapes
 */
async function createTextWithShapes(
  scene: THREE.Scene,
  position: THREE.Vector3
): Promise<void> {
  const words = ["QUANDO", "ERAVAMO", "ANCORA", "INSIEME"];
  
  const textGroup = new THREE.Group();
  
  // Load plastered wall textures (same as temple walls)
  const wallTextures = await loadPlasteredWallTextures();
  
  const textMaterial = new THREE.MeshStandardMaterial({
    metalness: 0.1,
    roughness: 0.7,
  });
  
  // Apply wall textures
  if (wallTextures.map) {
    textMaterial.map = wallTextures.map;
    textMaterial.map.wrapS = THREE.RepeatWrapping;
    textMaterial.map.wrapT = THREE.RepeatWrapping;
    textMaterial.map.repeat.set(0.5, 0.5);
  }
  
  if (wallTextures.normalMap) {
    textMaterial.normalMap = wallTextures.normalMap;
    textMaterial.normalMap.wrapS = THREE.RepeatWrapping;
    textMaterial.normalMap.wrapT = THREE.RepeatWrapping;
    textMaterial.normalMap.repeat.set(0.5, 0.5);
  }
  
  if (wallTextures.roughnessMap) {
    textMaterial.roughnessMap = wallTextures.roughnessMap;
    textMaterial.roughnessMap.wrapS = THREE.RepeatWrapping;
    textMaterial.roughnessMap.wrapT = THREE.RepeatWrapping;
    textMaterial.roughnessMap.repeat.set(0.5, 0.5);
  }

  // For fallback, we'll create simple rectangular blocks as placeholders
  // In a real scenario, you'd want to load a font file
  const charWidth = 1.2; // Doubled from 0.6
  const charHeight = 2.0; // Doubled from 1.0
  const charDepth = 0.2;
  const spacing = 0.2; // Doubled from 0.1
  const lineHeight = -2.4; // Increased and doubled from -1.2

  let currentY = 0;

  for (const word of words) {
    const wordGroup = new THREE.Group();
    const wordLength = word.length;
    
    for (let i = 0; i < wordLength; i++) {
      const charGeometry = new THREE.BoxGeometry(charWidth, charHeight, charDepth);
      const charMesh = new THREE.Mesh(charGeometry, textMaterial);
      
      // Left-align: start from x=0
      charMesh.position.x = i * (charWidth + spacing);
      charMesh.castShadow = true;
      charMesh.receiveShadow = true;
      
      wordGroup.add(charMesh);
    }
    
    wordGroup.position.y = currentY;
    textGroup.add(wordGroup);
    currentY += lineHeight;
  }

  textGroup.position.copy(position);
  textGroup.rotation.x = -Math.PI / 2;
  // Rotate 20 degrees around Y axis
  textGroup.rotation.y = 20 * Math.PI / 180;
  
  scene.add(textGroup);
  console.log(`✅ Floor text created (fallback method) at position (${position.x}, ${position.y}, ${position.z})`);
}
