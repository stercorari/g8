import "./input.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { gsap } from "gsap";
import { analyzeMeshes, cleanupMeshes } from "./meshCleanup";
import { applyMaterialsFromFolder } from "./materialLoader";
import { createFloor } from "./floor";
import { detectAndFixGlitches, enableDepthPrecision, DEFAULT_GLITCH_CONFIG } from "./meshDebug";
import { setupCameraPositionLogger } from "./cameraUtils";
import { createDivineFlickeringLight } from "./flickeringLight";
import { createGhostlyImage } from "./ghostlyImage";
import { setupNighthawksLighting } from "./nighthawksAtmosphere";
import { setupBackgroundTexture } from "./backgroundTexture";
import { setupCinematicCamera } from "./cinematicCamera";
// import { addGraffitiToWalls } from "./graffiti";

/* ------------------------------------------------------------------
   BASIC SETUP
------------------------------------------------------------------ */

const scene = new THREE.Scene();
// Dark, moody background similar to Nighthawks (deep blue-black)
// Background texture will be multiplied over this base color
scene.background = new THREE.Color(0x0f0f1a);
// Setup background texture (multiplied over dark blue for subtle effect)
setupBackgroundTexture(scene);

// scene.add(new THREE.AxesHelper(5));

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(0, -10, 10);

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector("canvas") as HTMLCanvasElement,
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.sortObjects = true; // Sort objects by depth to reduce z-fighting

// Enable shadow maps
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows for better quality

// Enable depth precision improvements
enableDepthPrecision(renderer);

/* ------------------------------------------------------------------
   CONTROLS
------------------------------------------------------------------ */

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 10;
controls.maxDistance = 300;
controls.target.set(0, 0, 1);

/* ------------------------------------------------------------------
   LIGHTS
   (Will be replaced with Nighthawks atmosphere after model loads)
------------------------------------------------------------------ */

// Temporary lights - will be replaced by Nighthawks atmosphere
let ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);

let keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
keyLight.position.set(5, 10, 5);
scene.add(keyLight);

let fillLight = new THREE.DirectionalLight(0x88aaff, 0.6);
fillLight.position.set(-5, 3, -5);
scene.add(fillLight);

/* ------------------------------------------------------------------
   MODEL LOADING
------------------------------------------------------------------ */

const loader = new GLTFLoader();

loader.load(
  '/scene.gltf',
  async (gltf) => {
    const model = gltf.scene;
    
    // First, get overall model size to determine scale
    const overallBox = new THREE.Box3().setFromObject(model);
    const overallSize = overallBox.getSize(new THREE.Vector3());
    const modelScale = Math.max(overallSize.x, overallSize.y, overallSize.z);
    
    // Analyze all meshes
    const allMeshes = analyzeMeshes(model);
    
    // Clean up meshes (remove distant pieces and large flat planes)
    cleanupMeshes(model, allMeshes, modelScale);
    
    // Load and apply materials from materials folder
    await applyMaterialsFromFolder(model);
    
    scene.add(model);

    model.scale.setScalar(0.06);
    
    // Final cleanup pass after scaling to catch any remaining glitches
    detectAndFixGlitches(model, {
      ...DEFAULT_GLITCH_CONFIG,
      // Slightly more aggressive than default
      tinySizeThreshold: 0.002,      // 0.2% of main model
      smallSizeThreshold: 0.004,     // 0.4% for pattern detection
      tinyVolumeThreshold: 0.0003,    // Slightly larger volume threshold
    }); 

    // Calculate model bounds for positioning
    const box = new THREE.Box3().setFromObject(model);
    const modelCenter = box.getCenter(new THREE.Vector3());
    const modelSize = box.getSize(new THREE.Vector3());
    const modelHeight = modelSize.y;
    const modelBottom = box.min.y;
    
    // Create floor with ghiaia material below the model
    const floorSize = Math.max(modelSize.x, modelSize.z) * 3; // Floor extends beyond model
    const floorY = modelBottom - 0.5; // Position floor slightly below the model's bottom
    await createFloor(scene, floorSize, floorY);
    
    // Set initial camera position and target (captured visually)
    controls.target.set(-12.1638, 17.1302, 1.3872);
    camera.position.set(-103.3936, 32.7233, 50.2306);
    
    // Update controls to reflect the new camera position
    controls.update();
    
    // Setup keyboard shortcut to capture current camera position (Press 'P')
    setupCameraPositionLogger(camera, controls);
    
    // Setup Nighthawks-inspired lighting only (warm interior lights)
    const nighthawksLights = setupNighthawksLighting(scene);
    // Update references to use the new lights
    ambient = nighthawksLights.ambient;
    keyLight = nighthawksLights.keyLight;
    fillLight = nighthawksLights.fillLight;
    
    // Add flickering divine light from above (broken light of god effect)
    createDivineFlickeringLight(scene, modelCenter, modelHeight);
    
    // Add ghostly image inside the temple
    // Position it near the center of the model, slightly forward
    const ghostPosition = modelCenter.clone();
    ghostPosition.y -= modelHeight * 0.1; // Position it higher up
    ghostPosition.z += 2; // Slightly forward
    
    createGhostlyImage(
      scene,
      '/people.png',
      ghostPosition,
      { width: modelSize.x * 1.2, height: modelSize.y * 0.6 } // Scale relative to model
    );
    
    // Add graffiti to temple walls
    // addGraffitiToWalls(scene, model, 10);
    
    // Setup cinematic camera orchestration
    setupCinematicCamera(
      camera,
      controls,
      modelCenter,
      modelSize,
      true // Auto-start the cinematic sequence
    );
  },
  undefined,
  (err) => console.error(err)
);

/* ------------------------------------------------------------------
   CAMERA ANIMATION (GSAP)
------------------------------------------------------------------ */

// const cameraAnimation = gsap.to(camera.position, {
//   duration: 12,
//   repeat: -1,
//   yoyo: true,
//   ease: "sine.inOut",
//   x: "+=2",
//   z: "-=3"
// });

// // Stop camera animation when user interacts with controls
// let hasInteracted = false;
// const stopCameraAnimation = () => {
//   if (!hasInteracted) {
//     cameraAnimation.kill();
//     hasInteracted = true;
//   }
// };

// controls.addEventListener('start', stopCameraAnimation);

gsap.to(keyLight.position, {
  duration: 10,
  repeat: -1,
  yoyo: true,
  ease: "sine.inOut",
  x: "-=4",
  z: "+=2"
});

/* ------------------------------------------------------------------
   UI ANIMATIONS
------------------------------------------------------------------ */

gsap.from("#title", {
  y: 40,
  opacity: 0,
  duration: 1.2,
  ease: "power3.out"
});

gsap.from("#subtitle", {
  y: 20,
  opacity: 0,
  duration: 1.2,
  delay: 0.3,
  ease: "power3.out"
});

/* ------------------------------------------------------------------
   RENDER LOOP
------------------------------------------------------------------ */

function animate(): void {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();

/* ------------------------------------------------------------------
   RESIZE
------------------------------------------------------------------ */

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
