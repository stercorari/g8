import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { gsap } from "gsap";

/**
 * Cinematic Camera Orchestration
 * Creates elegant, non-continuous camera movements to showcase the temple
 */

export interface CameraShot {
  name: string;
  startPosition: THREE.Vector3;
  endPosition: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  duration: number;
  ease?: string;
}

export class CinematicCameraOrchestrator {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private modelCenter: THREE.Vector3;
  private modelSize: THREE.Vector3;
  private timeline: gsap.core.Timeline | null = null;
  private isPlaying: boolean = false;
  private userInteracted: boolean = false;

  constructor(
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    modelCenter: THREE.Vector3,
    modelSize: THREE.Vector3
  ) {
    this.camera = camera;
    this.controls = controls;
    this.modelCenter = modelCenter;
    this.modelSize = modelSize;

    // Listen for user interaction to pause cinematic
    this.setupInteractionListener();
  }

  /**
   * Setup listener to pause cinematic when user interacts
   */
  private setupInteractionListener(): void {
    const pauseCinematic = () => {
      if (this.isPlaying && !this.userInteracted) {
        this.pause();
        this.userInteracted = true;
      }
    };

    this.controls.addEventListener('start', pauseCinematic);
    window.addEventListener('wheel', pauseCinematic, { once: true });
    window.addEventListener('mousedown', pauseCinematic, { once: true });
    window.addEventListener('touchstart', pauseCinematic, { once: true });
  }

  /**
   * Generate cinematic shots based on model dimensions
   * Each shot has continuous movement, with jump cuts between shots
   * Focus on close-ups of front and sides, avoiding roof and back
   */
  private generateShots(): CameraShot[] {
    const center = this.modelCenter;
    const size = this.modelSize;
    const maxDim = Math.max(size.x, size.y, size.z);
    const closeDistance = maxDim * 1.5; // Close but not too close
    const midDistance = maxDim * 2.0; // Medium distance for variety

    return [
      // 1. Front close-up - slow dolly forward
      {
        name: "Front Close-up",
        startPosition: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.3,
          center.z + midDistance * 0.8
        ),
        endPosition: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.25,
          center.z + closeDistance * 0.6
        ),
        startTarget: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.2,
          center.z
        ),
        endTarget: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.15,
          center.z
        ),
        duration: 5,
        ease: "power1.inOut"
      },

      // 2. Left side close-up - arc movement
      {
        name: "Left Side Close-up",
        startPosition: new THREE.Vector3(
          center.x - closeDistance * 0.9,
          center.y + maxDim * 0.25,
          center.z + closeDistance * 0.3
        ),
        endPosition: new THREE.Vector3(
          center.x - closeDistance * 0.6,
          center.y + maxDim * 0.2,
          center.z + closeDistance * 0.2
        ),
        startTarget: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.15,
          center.z
        ),
        endTarget: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.1,
          center.z
        ),
        duration: 5,
        ease: "sine.inOut"
      },

      // 3. Low angle front - dramatic upward movement
      {
        name: "Low Angle Front",
        startPosition: new THREE.Vector3(
          center.x,
          center.y - maxDim * 0.1,
          center.z + closeDistance * 0.7
        ),
        endPosition: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.1,
          center.z + closeDistance * 0.5
        ),
        startTarget: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.25,
          center.z
        ),
        endTarget: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.3,
          center.z
        ),
        duration: 5,
        ease: "power2.out"
      },

      // 4. Right side detail - close pan
      {
        name: "Right Side Detail",
        startPosition: new THREE.Vector3(
          center.x + closeDistance * 0.8,
          center.y + maxDim * 0.2,
          center.z + closeDistance * 0.4
        ),
        endPosition: new THREE.Vector3(
          center.x + closeDistance * 0.5,
          center.y + maxDim * 0.18,
          center.z + closeDistance * 0.3
        ),
        startTarget: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.15,
          center.z
        ),
        endTarget: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.12,
          center.z
        ),
        duration: 5,
        ease: "power1.inOut"
      },

      // 5. Front-left angle - intimate view
      {
        name: "Front-Left Intimate",
        startPosition: new THREE.Vector3(
          center.x - closeDistance * 0.5,
          center.y + maxDim * 0.22,
          center.z + closeDistance * 0.7
        ),
        endPosition: new THREE.Vector3(
          center.x - closeDistance * 0.3,
          center.y + maxDim * 0.2,
          center.z + closeDistance * 0.5
        ),
        startTarget: new THREE.Vector3(
          center.x + maxDim * 0.1,
          center.y + maxDim * 0.15,
          center.z
        ),
        endTarget: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.12,
          center.z
        ),
        duration: 5,
        ease: "power2.inOut"
      },

      // 6. Extreme close-up - architectural detail
      {
        name: "Extreme Close-up",
        startPosition: new THREE.Vector3(
          center.x + closeDistance * 0.3,
          center.y + maxDim * 0.18,
          center.z + closeDistance * 0.5
        ),
        endPosition: new THREE.Vector3(
          center.x + closeDistance * 0.2,
          center.y + maxDim * 0.15,
          center.z + closeDistance * 0.35
        ),
        startTarget: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.12,
          center.z
        ),
        endTarget: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.1,
          center.z
        ),
        duration: 4,
        ease: "power2.inOut"
      },

      // 7. Front medium shot - slight pullback
      {
        name: "Front Medium",
        startPosition: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.2,
          center.z + closeDistance * 0.5
        ),
        endPosition: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.25,
          center.z + midDistance * 0.7
        ),
        startTarget: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.15,
          center.z
        ),
        endTarget: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.18,
          center.z
        ),
        duration: 5,
        ease: "power1.inOut"
      },

      // 8. Final front close-up - slow push in
      {
        name: "Final Push",
        startPosition: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.24,
          center.z + midDistance * 0.6
        ),
        endPosition: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.2,
          center.z + closeDistance * 0.4
        ),
        startTarget: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.15,
          center.z
        ),
        endTarget: new THREE.Vector3(
          center.x,
          center.y + maxDim * 0.12,
          center.z
        ),
        duration: 6,
        ease: "sine.inOut"
      }
    ];
  }

  /**
   * Create and play the cinematic sequence
   * Camera continuously moves, with jump cuts between shots
   */
  public play(): void {
    if (this.isPlaying) {
      return;
    }

    this.isPlaying = true;
    const shots = this.generateShots();
    
    // Disable controls during cinematic
    this.controls.enabled = false;

    // Create master timeline
    this.timeline = gsap.timeline({
      repeat: -1, // Loop infinitely
      onComplete: () => {
        this.isPlaying = false;
        // Re-enable controls after cinematic ends
        if (!this.userInteracted) {
          this.controls.enabled = true;
        }
      }
    });

    let totalTime = 0;

    shots.forEach((shot) => {
      // Jump cut: instantly set camera to start position
      this.timeline!.call(
        () => {
          this.camera.position.set(
            shot.startPosition.x,
            shot.startPosition.y,
            shot.startPosition.z
          );
          this.controls.target.set(
            shot.startTarget.x,
            shot.startTarget.y,
            shot.startTarget.z
          );
          this.controls.update();
        },
        [],
        totalTime
      );

      // Animate camera position from start to end (continuous movement)
      this.timeline!.to(
        this.camera.position,
        {
          x: shot.endPosition.x,
          y: shot.endPosition.y,
          z: shot.endPosition.z,
          duration: shot.duration,
          ease: shot.ease || "power2.inOut",
        },
        totalTime
      );

      // Animate controls target from start to end
      this.timeline!.to(
        this.controls.target,
        {
          x: shot.endTarget.x,
          y: shot.endTarget.y,
          z: shot.endTarget.z,
          duration: shot.duration,
          ease: shot.ease || "power2.inOut",
        },
        totalTime
      );

      // Update controls continuously during movement
      this.timeline!.call(
        () => {
          this.controls.update();
        },
        [],
        totalTime + shot.duration
      );

      // Move to next shot time (no delay, instant jump cut)
      totalTime += shot.duration;
    });

    console.log("🎬 Cinematic camera sequence started (continuous movement with jump cuts)");
  }

  /**
   * Pause the cinematic sequence
   */
  public pause(): void {
    if (this.timeline) {
      this.timeline.pause();
      this.isPlaying = false;
      this.controls.enabled = true;
      console.log("⏸️ Cinematic camera paused");
    }
  }

  /**
   * Stop and reset the cinematic sequence
   */
  public stop(): void {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
      this.isPlaying = false;
      this.controls.enabled = true;
      console.log("⏹️ Cinematic camera stopped");
    }
  }

  /**
   * Restart the cinematic sequence
   */
  public restart(): void {
    this.stop();
    this.userInteracted = false;
    this.play();
  }

  /**
   * Check if cinematic is currently playing
   */
  public get playing(): boolean {
    return this.isPlaying;
  }
}

/**
 * Setup and start cinematic camera orchestration
 */
export function setupCinematicCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  modelCenter: THREE.Vector3,
  modelSize: THREE.Vector3,
  autoStart: boolean = true
): CinematicCameraOrchestrator {
  const orchestrator = new CinematicCameraOrchestrator(
    camera,
    controls,
    modelCenter,
    modelSize
  );

  if (autoStart) {
    // Start after a brief delay to let the scene settle
    setTimeout(() => {
      orchestrator.play();
    }, 2000);
  }

  return orchestrator;
}
