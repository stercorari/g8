import "./input.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { gsap } from "gsap";
import { analyzeMeshes, cleanupMeshes } from "./meshCleanup";
import { applyMaterialsFromFolder } from "./materialLoader";
import { createFloor } from "./floor";
import { createFloorText } from "./floorText";
import { detectAndFixGlitches, enableDepthPrecision, DEFAULT_GLITCH_CONFIG } from "./meshDebug";
import { setupCameraPositionLogger } from "./cameraUtils";
import { createDivineFlickeringLight } from "./flickeringLight";
import { createGhostlyImage } from "./ghostlyImage";
import { setupNighthawksLighting } from "./nighthawksAtmosphere";
import { setupBackgroundTexture } from "./backgroundTexture";
// import { setupCinematicCamera } from "./cinematicCamera";
import { setupDollyCamera, DollyCamera } from "./dollyCamera";
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

// Add subtle fog for atmospheric effect
// Using exponential fog for more natural falloff
scene.fog = new THREE.FogExp2(0x0f0f1a, 0.005); // Dark fog matching background, very subtle density

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
   PROGRESS TRACKING
------------------------------------------------------------------ */

interface LoadingProgress {
  model: number;        // 0-40% - Model loading
  materials: number;    // 40-60% - Material textures
  floor: number;        // 60-75% - Floor textures
  text: number;         // 75-90% - Text font
  setup: number;        // 90-100% - Final setup
}

const progress: LoadingProgress = {
  model: 0,
  materials: 0,
  floor: 0,
  text: 0,
  setup: 0,
};

function updateProgress(): void {
  const total = 
    progress.model * 0.4 +
    progress.materials * 0.2 +
    progress.floor * 0.15 +
    progress.text * 0.15 +
    progress.setup * 0.1;
  
  const percentage = Math.round(total * 100);
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  
  if (progressBar) {
    progressBar.style.width = `${percentage}%`;
  }
  
  if (progressText) {
    progressText.textContent = `${percentage}%`;
  }
  
  console.log(`Progress: ${percentage}% (model: ${progress.model}, materials: ${progress.materials}, floor: ${progress.floor}, text: ${progress.text}, setup: ${progress.setup})`);
}

// Initialize progress bar
updateProgress();

/* ------------------------------------------------------------------
   MODEL LOADING
------------------------------------------------------------------ */

const loader = new GLTFLoader();

// Start loading
progress.model = 0.1;
updateProgress();

loader.load(
  `${import.meta.env.BASE_URL}scene.gltf`,
  async (gltf) => {
    progress.model = 1;
    updateProgress();
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
    progress.materials = 0.5;
    updateProgress();
    await applyMaterialsFromFolder(model);
    progress.materials = 1;
    updateProgress();
    
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
    const modelBottom = box.min.y;
    
    // Position floor at ground level (y=0 or modelBottom)
    // We'll move the model down so its bottom sits on the floor
    const floorY = 0; // Floor at ground level
    const modelOffsetY = floorY - modelBottom; // How much to move model down
    
    // Move the entire model down so its bottom sits on the floor
    model.position.y += modelOffsetY;
    
    // Recalculate model bounds after positioning
    box.setFromObject(model);
    const updatedModelCenter = box.getCenter(new THREE.Vector3());
    const updatedModelSize = box.getSize(new THREE.Vector3());
    
    // Create floor at ground level
    const floorSize = Math.max(updatedModelSize.x, updatedModelSize.z) * 3; // Floor extends beyond model
    progress.floor = 0.5;
    updateProgress();
    await createFloor(scene, floorSize, floorY);
    progress.floor = 1;
    updateProgress();
    
    // Create 3D text on the floor beside the temple
    progress.text = 0.5;
    updateProgress();
    await createFloorText(scene, box, floorY);
    progress.text = 1;
    updateProgress();
    
    // Set initial camera position and target (captured visually)
    const initialCameraPosition = new THREE.Vector3(-103.3936, 32.7233, 50.2306);
    const initialCameraTarget = new THREE.Vector3(-12.1638, 17.1302, 1.3872);
    
    camera.position.copy(initialCameraPosition);
    controls.target.copy(initialCameraTarget);
    
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
    createDivineFlickeringLight(scene, updatedModelCenter, updatedModelSize.y);
    
    // Add ghostly image inside the temple
    // Position it near the center of the model, slightly forward
    const ghostPosition = updatedModelCenter.clone();
    ghostPosition.y -= updatedModelSize.y * 0.1; // Position it higher up
    ghostPosition.z += 2; // Slightly forward
    
    createGhostlyImage(
      scene,
      `${import.meta.env.BASE_URL}people.png`,
      ghostPosition,
      { width: updatedModelSize.x * 1.2, height: updatedModelSize.y * 0.6 } // Scale relative to model
    );
    
    // Add graffiti to temple walls
    // addGraffitiToWalls(scene, model, 10);
    
    // Setup dolly camera (low, slow, continuous movement)
    progress.setup = 0.5;
    updateProgress();
    const dollyCamera = setupDollyCamera(
      camera,
      controls,
      updatedModelCenter,
      updatedModelSize,
      floorY,
      true, // Auto-start the dolly movement
      initialCameraPosition,
      initialCameraTarget
    );
    progress.setup = 1;
    updateProgress();

    // Setup camera controls UI
    setupCameraControls(dollyCamera);

    // Hide loader once everything is ready
    setTimeout(() => {
      hideLoader();
    }, 300);
  },
  (progressEvent) => {
    // Track model loading progress
    // GLTFLoader progress event has loaded and total properties
    try {
      if (progressEvent.total && progressEvent.total > 0) {
        progress.model = Math.min(progressEvent.loaded / progressEvent.total, 0.95);
      } else if (progressEvent.loaded !== undefined) {
        // Increment based on loaded bytes
        progress.model = Math.min(0.1 + (progressEvent.loaded / 1000000) * 0.8, 0.95);
      } else {
        // Fallback: increment gradually
        progress.model = Math.min(progress.model + 0.1, 0.95);
      }
      updateProgress();
    } catch (e) {
      console.warn('Progress tracking error:', e);
    }
  },
  (err) => {
    console.error(err);
    hideLoader(); // Hide loader even on error
  }
);

/**
 * Hides the loading overlay
 */
function hideLoader(): void {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.add('opacity-0', 'pointer-events-none');
    // Remove from DOM after fade out completes
    setTimeout(() => {
      loader.remove();
    }, 500);
  }
}

/**
 * Setup camera control buttons (play/pause/reset)
 */
function setupCameraControls(dollyCamera: DollyCamera): void {
  const playPauseBtn = document.getElementById('playPauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const playPauseIcon = document.getElementById('playPauseIcon');

  if (!playPauseBtn || !resetBtn || !playPauseIcon) {
    return;
  }

  // Toggle play/pause function
  const togglePlayPause = () => {
    if (dollyCamera.isPlaying()) {
      dollyCamera.pause();
      playPauseIcon.textContent = '▶';
    } else {
      dollyCamera.resume();
      playPauseIcon.textContent = '⏸';
    }
  };

  // Play/Pause button
  playPauseBtn.addEventListener('click', togglePlayPause);

  // Spacebar keyboard shortcut
  window.addEventListener('keydown', (event) => {
    // Only trigger if spacebar and not typing in an input field
    if (event.code === 'Space' && event.target === document.body) {
      event.preventDefault(); // Prevent page scroll
      togglePlayPause();
    }
  });

  // Reset button
  resetBtn.addEventListener('click', () => {
    dollyCamera.reset();
    playPauseIcon.textContent = '⏸';
  });
}

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
