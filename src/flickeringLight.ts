import * as THREE from "three";

/* ------------------------------------------------------------------
   FLICKERING LIGHT EFFECT
------------------------------------------------------------------ */

export interface FlickeringLightConfig {
  color: number;
  intensity: number;
  position: THREE.Vector3;
  flickerSpeed: number;      // How fast it flickers (0-1, higher = faster)
  glitchIntensity: number;   // How severe the glitches are (0-1)
  colorVariation: boolean;   // Whether to vary the color slightly
}

export class FlickeringLight {
  private light: THREE.SpotLight;
  private lightBeams: THREE.Mesh[] = [];
  private beamGroup: THREE.Group;
  private config: FlickeringLightConfig;
  private baseIntensity: number;
  private baseColor: number;
  private animationId: number | null = null;
  private isAnimating: boolean = false;
  private targetPosition: THREE.Vector3;

  constructor(config: FlickeringLightConfig, targetPosition: THREE.Vector3) {
    this.config = config;
    this.baseIntensity = config.intensity;
    this.baseColor = config.color;
    this.targetPosition = targetPosition;

    // Create spot light creating a cone beam from above
    this.light = new THREE.SpotLight(config.color, config.intensity);
    this.light.position.copy(config.position);
    this.light.target.position.copy(targetPosition);
    this.light.castShadow = true;
    this.light.angle = Math.PI / 6; // 30 degree cone angle
    this.light.penumbra = 0.3; // Soft edges
    this.light.decay = 1;
    this.light.distance = 500;
    
    // Configure shadow properties for better effect
    this.light.shadow.mapSize.width = 2048;
    this.light.shadow.mapSize.height = 2048;
    this.light.shadow.camera.near = 0.1;
    this.light.shadow.camera.far = 500;

    // Create a group to hold all beam meshes
    this.beamGroup = new THREE.Group();
    this.beamGroup.position.copy(config.position);

    // Create individual light beams forming a cone
    const beamHeight = config.position.distanceTo(targetPosition);
    const coneRadius = Math.tan(this.light.angle) * beamHeight;
    const numBeams = 24; // Number of distinct beams
    
    for (let i = 0; i < numBeams; i++) {
      const angle = (i / numBeams) * Math.PI * 2;
      const radius = coneRadius * (0.3 + Math.random() * 0.7); // Vary beam positions
      
      // Create thicker, softer beams
      const beamRadius = 0.5 + Math.random() * 0.3; // Thicker beams (was 0.2-0.35)
      const beamGeometry = new THREE.CylinderGeometry(
        beamRadius * 0.3, // Top radius (narrower at top)
        beamRadius,      // Bottom radius (wider at bottom)
        beamHeight,      // Height
        32,              // Even more segments for very smooth, soft edges
        1,               // Height segments
        false
      );
      
      // Create shader material for soft, bright beams with gradient falloff
      const beamMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(config.color) },
          uIntensity: { value: 1.0 },
          uTime: { value: 0 },
          uBeamHeight: { value: beamHeight } // Pass beam height to shader
        },
        vertexShader: `
          varying vec3 vPosition;
          varying vec3 vNormal;
          varying float vDistance;
          
          void main() {
            vPosition = position;
            vNormal = normalize(normalMatrix * normal);
            vDistance = length(position);
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uIntensity;
          uniform float uTime;
          uniform float uBeamHeight;
          
          varying vec3 vPosition;
          varying vec3 vNormal;
          varying float vDistance;
          
          void main() {
            // Calculate distance from center of cylinder (radial distance)
            float distFromCenter = length(vPosition.xz);
            
            // Make falloff vary along Y axis: softer at bottom (negative Y), sharper at top (positive Y)
            // Normalize Y position (cylinder extends from -height/2 to +height/2)
            // Map Y from [-height/2, +height/2] to [0, 1] where 0 = bottom, 1 = top
            float halfHeight = uBeamHeight * 0.5;
            float yNormalized = (vPosition.y + halfHeight) / uBeamHeight;
            yNormalized = clamp(yNormalized, 0.0, 1.0);
            
            // Bottom should have softer falloff (larger divisor), top should be sharper (smaller divisor)
            float falloffDivisor = mix(0.7, 0.3, yNormalized); // 0.7 at bottom (softer), 0.3 at top (sharper)
            float normalizedDist = distFromCenter / falloffDivisor;
            
            // Very soft, gradual falloff from center to edge
            // Start fading from center, not just at edges - use wider smoothstep range
            float falloff = 1.0 - smoothstep(0.0, 1.5, normalizedDist);
            // Softer power curve at bottom, sharper at top
            float powerCurve = mix(1.5, 2.5, yNormalized); // 0.5 at bottom (softer), 2.5 at top (sharper)
            falloff = pow(falloff, powerCurve);
            // Additional smoothing for ultra-soft edges
            falloff = smoothstep(0.0, 1.0, falloff);
            
            // Add slight vertical gradient (brighter at top, dimmer at bottom)
            float verticalGradient = 1.0 - abs(vPosition.y) / halfHeight;
            verticalGradient = max(0.3, verticalGradient);
            
            // Combine falloffs with very gradual transition
            float alpha = falloff * verticalGradient * uIntensity;
            
            // Very bright color with soft edges
            vec3 finalColor = uColor * (1.5 + uIntensity * 0.5);
            
            gl_FragColor = vec4(finalColor, alpha * 0.35); // Softer, more gradual
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      
      // Calculate direction for this beam (spreading outward in cone)
      // Each beam should angle outward from the center
      const targetX = Math.cos(angle) * radius;
      const targetZ = Math.sin(angle) * radius;
      const targetY = targetPosition.y - config.position.y;
      
      // Calculate direction vector (from center outward)
      const direction = new THREE.Vector3(targetX, targetY, targetZ).normalize();
      
      // Position beam starting from the light source (top center)
      beam.position.set(0, 0, 0);
      
      // Rotate cylinder to point along the direction
      // Cylinders default to pointing up (0, 1, 0)
      const up = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(up, direction);
      beam.applyQuaternion(quaternion);
      
      // Move beam so it extends from source outward
      // The cylinder center should be at half its length along the direction
      const halfLength = beamHeight / 2;
      beam.position.copy(direction.clone().multiplyScalar(halfLength));
      
      this.lightBeams.push(beam);
      this.beamGroup.add(beam);
    }
  }

  getLight(): THREE.SpotLight {
    return this.light;
  }

  getLightTarget(): THREE.Object3D {
    return this.light.target;
  }

  getBeamGroup(): THREE.Group {
    return this.beamGroup;
  }

  start(): void {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this.animate();
  }

  stop(): void {
    this.isAnimating = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    // Reset to base values
    this.light.intensity = this.baseIntensity;
    this.light.color.setHex(this.baseColor);
  }

  private animate = (): void => {
    if (!this.isAnimating) return;

    const time = Date.now() * 0.001;
    
    // Base flicker using noise-like function
    const flicker = Math.sin(time * 20 * this.config.flickerSpeed) * 
                    Math.sin(time * 37 * this.config.flickerSpeed) *
                    Math.sin(time * 7 * this.config.flickerSpeed);
    
    // Random glitches (sudden drops or spikes)
    let glitch = 1;
    const glitchChance = Math.random();
    if (glitchChance < 0.1 * this.config.glitchIntensity) {
      // Sudden drop (light goes out briefly)
      glitch = Math.random() * 0.3;
    } else if (glitchChance < 0.15 * this.config.glitchIntensity) {
      // Sudden spike (bright flash)
      glitch = 1.5 + Math.random() * 0.5;
    } else if (glitchChance < 0.2 * this.config.glitchIntensity) {
      // Rapid flicker
      glitch = 0.5 + Math.random() * 0.8;
    }
    
    // Combine flicker and glitch
    const intensityMultiplier = 0.7 + (flicker * 0.3) * glitch;
    this.light.intensity = this.baseIntensity * Math.max(0.1, Math.min(2.0, intensityMultiplier));
    
    // Optional color variation (slight shifts toward white/yellow during glitches)
    if (this.config.colorVariation) {
      const colorShift = (glitch > 1.2) ? 0.1 : 0;
      const r = Math.min(1, ((this.baseColor >> 16) & 0xff) / 255 + colorShift);
      const g = Math.min(1, ((this.baseColor >> 8) & 0xff) / 255 + colorShift);
      const b = Math.min(1, (this.baseColor & 0xff) / 255 - colorShift * 0.5);
      this.light.color.setRGB(r, g, b);
      
      // Update beam colors too
      this.lightBeams.forEach(beam => {
        if (beam.material instanceof THREE.MeshBasicMaterial) {
          beam.material.color.setRGB(r, g, b);
        }
      });
    }
    
    // Slight position jitter for more realistic broken light effect
    const jitterAmount = 0.5 * this.config.glitchIntensity;
    this.light.position.x = this.config.position.x + (Math.random() - 0.5) * jitterAmount;
    this.light.position.y = this.config.position.y + (Math.random() - 0.5) * jitterAmount * 0.5;
    this.light.position.z = this.config.position.z + (Math.random() - 0.5) * jitterAmount;
    
    // Update light target position (slight jitter)
    this.light.target.position.x = this.targetPosition.x + (Math.random() - 0.5) * jitterAmount * 0.3;
    this.light.target.position.y = this.targetPosition.y;
    this.light.target.position.z = this.targetPosition.z + (Math.random() - 0.5) * jitterAmount * 0.3;
    
    // Update beam group position to match light
    this.beamGroup.position.copy(this.light.position);
    
    // Update individual beams opacity and intensity based on flicker
    const intensityRatio = this.light.intensity / this.baseIntensity;
    this.lightBeams.forEach((beam, index) => {
      if (beam.material instanceof THREE.ShaderMaterial) {
        // Update shader uniforms for intensity and color
        beam.material.uniforms.uIntensity.value = intensityRatio;
        beam.material.uniforms.uColor.value.copy(this.light.color);
        beam.material.uniforms.uTime.value = time;
        
        // Slight scale variation during flicker
        const scale = 0.95 + (intensityRatio * 0.1);
        beam.scale.set(scale, 1, scale);
      } else if (beam.material instanceof THREE.MeshBasicMaterial) {
        // Fallback for non-shader materials
        const baseOpacity = 0.1 + (index % 3) * 0.05;
        beam.material.opacity = Math.min(0.25, baseOpacity * intensityRatio);
        beam.material.color.copy(this.light.color);
        const scale = 0.95 + (intensityRatio * 0.1);
        beam.scale.set(scale, 1, scale);
      }
    });

    this.animationId = requestAnimationFrame(this.animate);
  };

  updateConfig(config: Partial<FlickeringLightConfig>): void {
    this.config = { ...this.config, ...config };
    this.baseIntensity = this.config.intensity;
    this.baseColor = this.config.color;
    this.light.color.setHex(this.config.color);
    this.light.position.copy(this.config.position);
  }
}

/**
 * Creates and adds a flickering divine light effect to the scene
 * 
 * @param scene - The Three.js scene
 * @param modelCenter - Center position of the model (to position light above it)
 * @param modelHeight - Height of the model (to position light appropriately)
 * @returns The FlickeringLight instance
 */
export function createDivineFlickeringLight(
  scene: THREE.Scene,
  modelCenter: THREE.Vector3,
  modelHeight: number
): FlickeringLight {
  // Position light above the model (after scaling, so use absolute position)
  // Since model is scaled to 0.05, we need to account for that
  const lightPosition = new THREE.Vector3(
    modelCenter.x,
    modelCenter.y + modelHeight * 0.4, // Increased to 2x for better visibility
    modelCenter.z
  );

  console.log('🔦 Creating flickering light at:', lightPosition);
  console.log('   Model center:', modelCenter);
  console.log('   Model height:', modelHeight);

  // Target position (center of model, slightly above ground)
  const targetPosition = new THREE.Vector3(
    modelCenter.x,
    modelCenter.y - modelHeight * 0.3, // Slightly below center
    modelCenter.z
  );

  const flickeringLight = new FlickeringLight({
    color: 0xffd700,           // Gold color for divine light
    intensity: 8.0,
    position: lightPosition,
    flickerSpeed: 0.8,
    glitchIntensity: 0.6,
    colorVariation: true,
  }, targetPosition);

  scene.add(flickeringLight.getLight());
  scene.add(flickeringLight.getLightTarget());
  scene.add(flickeringLight.getBeamGroup());
  
  console.log('   Light beam group added with', flickeringLight.getBeamGroup().children.length, 'beams');
  
  flickeringLight.start();

  return flickeringLight;
}
