import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { gsap } from "gsap";

/**
 * Dolly Camera System
 * Creates smooth, continuous camera movement that stays low to the ground
 * Like the point of view of a small animal exploring the scene
 */

export class DollyCamera {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private modelCenter: THREE.Vector3;
  private floorY: number;
  private animationTimeline: gsap.core.Timeline | null = null;
  private isActive: boolean = false;
  private initialPosition: THREE.Vector3 | null = null;
  private initialTarget: THREE.Vector3 | null = null;

  // Camera parameters
  private readonly baseHeight: number = 2.5; // Height above floor (raised perspective)
  private readonly orbitRadius: number = 15; // Base distance from model center

  constructor(
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    modelCenter: THREE.Vector3,
    modelSize: THREE.Vector3,
    floorY: number,
    initialPosition?: THREE.Vector3,
    initialTarget?: THREE.Vector3
  ) {
    this.camera = camera;
    this.controls = controls;
    this.modelCenter = modelCenter;
    this.floorY = floorY;
    this.initialPosition = initialPosition || null;
    this.initialTarget = initialTarget || null;

    // Calculate orbit radius based on model size
    const maxDimension = Math.max(modelSize.x, modelSize.z);
    this.orbitRadius = maxDimension * 0.8;
  }

  /**
   * Start the dolly camera movement
   */
  public start(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    
    // Disable manual controls during dolly movement
    this.controls.enabled = false;

    // Create continuous animation timeline
    this.animationTimeline = gsap.timeline({
      repeat: -1, // Loop infinitely
      ease: "none" // Linear movement for smooth continuous motion
    });

    // If we have an initial position, smoothly transition from it to the animal-like position
    if (this.initialPosition && this.initialTarget) {
      // Store current position (should be the initial position set in main.ts)
      
      // Calculate the animal-like starting position
      const initialAngle = Math.PI * 0.25; // Start at 45 degrees
      const radius = this.orbitRadius;
      const animalX = this.modelCenter.x + Math.cos(initialAngle) * radius;
      const animalZ = this.modelCenter.z + Math.sin(initialAngle) * radius;
      const animalY = this.floorY + this.baseHeight;
      const animalPos = new THREE.Vector3(animalX, animalY, animalZ);
      
      // Animal-like look target
      const animalTargetY = this.modelCenter.y * 0.4;
      const animalTarget = new THREE.Vector3(this.modelCenter.x, animalTargetY, this.modelCenter.z);

      // Smooth transition from initial position to animal position (8 seconds)
      this.animationTimeline.to(this.camera.position, {
        x: animalPos.x,
        y: animalPos.y,
        z: animalPos.z,
        duration: 8,
        ease: "power2.inOut",
        onUpdate: () => {
          this.controls.update();
        }
      });

      this.animationTimeline.to(this.controls.target, {
        x: animalTarget.x,
        y: animalTarget.y,
        z: animalTarget.z,
        duration: 8,
        ease: "power2.inOut",
        onUpdate: () => {
          this.controls.update();
        }
      }, 0); // Start at same time as position animation

      // After transition, start the orbit path
      // The orbit path will be added to the timeline starting after the transition
      this.createOrbitPath();
    } else {
      // No initial position, start directly from animal position
      const initialAngle = Math.PI * 0.25;
      this.setCameraPosition(initialAngle, 0, 0);
      this.setCameraLookTarget(initialAngle, 0);
      this.createOrbitPath();
    }
  }

  /**
   * Pause the dolly camera movement
   */
  public pause(): void {
    if (!this.isActive || !this.animationTimeline) {
      return;
    }

    this.animationTimeline.pause();
    // Re-enable controls when paused
    this.controls.enabled = true;
  }

  /**
   * Resume the dolly camera movement
   */
  public resume(): void {
    if (!this.isActive || !this.animationTimeline) {
      return;
    }

    this.animationTimeline.resume();
    // Disable controls when resuming
    this.controls.enabled = false;
  }

  /**
   * Stop the dolly camera movement
   */
  public stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    
    if (this.animationTimeline) {
      this.animationTimeline.kill();
      this.animationTimeline = null;
    }

    // Re-enable controls
    this.controls.enabled = true;
  }

  /**
   * Reset the dolly camera to the beginning
   */
  public reset(): void {
    // Stop current animation
    this.stop();
    
    // Restart from beginning
    this.start();
  }

  /**
   * Check if camera is currently playing
   */
  public isPlaying(): boolean {
    return this.isActive && this.animationTimeline !== null && !this.animationTimeline.paused();
  }

  /**
   * Set camera position based on angle around the model with variation
   */
  private setCameraPosition(angle: number, radiusVariation: number = 0, heightVariation: number = 0): void {
    // Calculate position with radius variation (makes path more interesting than a perfect circle)
    const radius = this.orbitRadius + radiusVariation;
    const x = this.modelCenter.x + Math.cos(angle) * radius;
    const z = this.modelCenter.z + Math.sin(angle) * radius;
    const y = this.floorY + this.baseHeight + heightVariation;

    this.camera.position.set(x, y, z);
  }

  /**
   * Set camera look target with dynamic head movement
   */
  private setCameraLookTarget(angle: number, time: number): void {
    // Vary look target height - sometimes look up, sometimes look down
    const baseLookHeight = this.modelCenter.y * 0.4;
    
    // Create more dynamic head movement
    // Look up periodically (like checking things out)
    const lookUpCycle = Math.sin(time * 0.3) * 0.5 + 0.5; // 0 to 1
    const lookUpAmount = lookUpCycle * this.modelCenter.y * 0.6; // Look up to 60% of model height
    
    // Horizontal head movement (looking around)
    const lookOffsetX = Math.sin(time * 0.7) * 2 + Math.sin(angle * 2) * 1;
    const lookOffsetZ = Math.cos(time * 0.5) * 2 + Math.cos(angle * 1.5) * 1;
    
    // Sometimes look more forward, sometimes more to the side
    const lookAheadFactor = Math.sin(time * 0.4) * 0.3 + 0.7; // 0.4 to 1.0
    
    const targetX = this.modelCenter.x + lookOffsetX * lookAheadFactor;
    const targetY = baseLookHeight + lookUpAmount;
    const targetZ = this.modelCenter.z + lookOffsetZ * lookAheadFactor;
    
    this.controls.target.set(targetX, targetY, targetZ);
    this.controls.update();
  }

  /**
   * Create a more interesting, varied orbit path (not just a perfect circle)
   */
  private createOrbitPath(): void {
    if (!this.animationTimeline) {
      return;
    }

    const duration = 60; // Slow orbit: 60 seconds for full circle
    const startTime = this.animationTimeline.duration(); // Start after any existing animations

    // Animate camera position with variation
    const positionObj = { angle: 0, time: 0 };
    
    this.animationTimeline.to(positionObj, {
      angle: Math.PI * 2,
      time: duration,
      duration: duration,
      ease: "none", // Linear for smooth continuous motion
      repeat: -1,
      onUpdate: () => {
        const angle = positionObj.angle;
        const time = positionObj.time;
        
        // Vary the radius to create a more organic, less circular path
        // Creates an elliptical/irregular orbit
        const radiusVariation = Math.sin(angle * 3) * 3 + Math.cos(angle * 2) * 2;
        
        // Vary height - sometimes go higher, sometimes lower
        const heightVariation = Math.sin(angle * 4) * 0.8 + Math.cos(time * 0.2) * 0.5;
        
        // Add walking bobbing motion
        const bobAmount = 0.15;
        const bobFrequency = 6; // How many bobs per orbit
        const bobOffset = Math.sin(angle * bobFrequency) * bobAmount;
        
        this.setCameraPosition(angle, radiusVariation, heightVariation + bobOffset);
        
        // Set dynamic look target with head movement
        this.setCameraLookTarget(angle, time);
      }
    }, startTime);
  }

  /**
   * Update camera position (called in render loop for smooth updates)
   */
  public update(): void {
    if (!this.isActive) {
      return;
    }
    // GSAP handles the updates, but we can add additional smoothness here if needed
  }
}

/**
 * Setup and start dolly camera movement
 */
export function setupDollyCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  modelCenter: THREE.Vector3,
  modelSize: THREE.Vector3,
  floorY: number,
  autoStart: boolean = true,
  initialPosition?: THREE.Vector3,
  initialTarget?: THREE.Vector3
): DollyCamera {
  const dollyCamera = new DollyCamera(
    camera,
    controls,
    modelCenter,
    modelSize,
    floorY,
    initialPosition,
    initialTarget
  );

  if (autoStart) {
    // Start after a brief delay to let the scene settle
    setTimeout(() => {
      dollyCamera.start();
    }, 1000);
  }

  return dollyCamera;
}
