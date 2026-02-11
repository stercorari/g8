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

interface BeamFlickerState {
  state: 'steady' | 'flickering' | 'sparking' | 'break';
  stateStartTime: number;
  stateDuration: number;
  phase: number; // Random phase offset for each beam
}

export class FlickeringLight {
  private light: THREE.SpotLight;
  private pointLight: THREE.PointLight; // Additional point light for ambient-like illumination
  private lightBeams: THREE.Mesh[] = [];
  private beamFlickerStates: BeamFlickerState[] = [];
  private beamGroup: THREE.Group;
  private config: FlickeringLightConfig;
  private baseIntensity: number;
  private baseColor: number;
  private animationId: number | null = null;
  private isAnimating: boolean = false;
  private targetPosition: THREE.Vector3;
  private flickerState: 'steady' | 'flickering' | 'sparking' | 'break' = 'steady';
  private stateStartTime: number = 0;
  private stateDuration: number = 0;

  constructor(config: FlickeringLightConfig, targetPosition: THREE.Vector3) {
    this.config = config;
    this.baseIntensity = config.intensity * 2.0; // Increased intensity to illuminate environment
    this.baseColor = config.color;
    this.targetPosition = targetPosition;

    // Create spot light creating a cone beam from above
    // Increased intensity to better illuminate the environment
    this.light = new THREE.SpotLight(config.color, config.intensity * 2.0);
    this.light.position.copy(config.position);
    this.light.target.position.copy(targetPosition);
    this.light.castShadow = true;
    this.light.angle = Math.PI / 8; // Narrower ~22.5 degree cone angle to avoid crossing columns
    this.light.penumbra = 0.8; // Softer, more gradual edges
    this.light.decay = 0.5; // Slower decay so light travels further
    this.light.distance = 1000; // Increased range to affect more of the scene
    
    // Configure shadow properties for better effect
    this.light.shadow.mapSize.width = 2048;
    this.light.shadow.mapSize.height = 2048;
    this.light.shadow.camera.near = 0.1;
    this.light.shadow.camera.far = 1000;
    this.light.shadow.bias = -0.0001; // Reduce shadow acne
    
    // Add a point light at the same position for ambient-like illumination
    // This helps the light affect the environment more broadly
    this.pointLight = new THREE.PointLight(config.color, config.intensity * 0.8);
    this.pointLight.position.copy(config.position);
    this.pointLight.castShadow = false; // Don't cast shadows from point light (spot light handles that)
    this.pointLight.decay = 1.5; // Moderate decay
    this.pointLight.distance = 500; // Good range for ambient illumination

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
      
      // Create 3x thicker, softer beams
      const baseRadius = (0.5 + Math.random() * 0.3) * 3;
      const beamGeometry = new THREE.CylinderGeometry(
        baseRadius * 0.15, // Top radius (much narrower at top for ultra-soft fade)
        baseRadius,        // Bottom radius (wider at bottom)
        beamHeight,       // Height
        64,               // Maximum segments for ultra-smooth, feathered edges
        64,               // Maximum height segments for perfectly smooth vertical falloff
        true              // Open ended - no caps to avoid truncated look
      );
      
      // Create shader material for soft, bright beams with gradient falloff
      const beamMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(config.color) },
          uIntensity: { value: 1.0 },
          uTime: { value: 0 },
          uBeamHeight: { value: beamHeight }, // Pass beam height to shader
          uBeamRadius: { value: baseRadius } // Pass beam radius to shader
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
          uniform float uBeamRadius;
          
          varying vec3 vPosition;
          varying vec3 vNormal;
          varying float vDistance;
          
          void main() {
            // Calculate distance from center of cylinder (radial distance)
            float distFromCenter = length(vPosition.xz);
            
            // Normalize Y position (cylinder extends from -height/2 to +height/2)
            // After rotation with negated direction: local +Y points UP (toward light source/origin)
            //                                        local -Y points DOWN (toward target/bottom)
            float halfHeight = uBeamHeight * 0.5;
            float yPos = vPosition.y;
            // Map Y from [-halfHeight, +halfHeight] to [0, 1]
            // yPos = +halfHeight is top/origin (want bright = 1.0)
            // yPos = -halfHeight is bottom/target (want dim = 0.0)
            // (yPos + halfHeight) maps: -halfHeight→0, +halfHeight→1
            // This already gives us top→1.0, bottom→0.0, so no inversion needed!
            float yNormalized = (yPos + halfHeight) / uBeamHeight;
            yNormalized = clamp(yNormalized, 0.0, 1.0);
            
            // Get the maximum radius at this Y position (interpolated from top to bottom)
            float topRadius = uBeamRadius * 0.2;
            float bottomRadius = uBeamRadius;
            float currentRadius = mix(topRadius, bottomRadius, yNormalized);
            
            // Radial falloff - ULTRA soft, completely feathered with no visible edges
            // Start fading from center, very gradual falloff
            float normalizedDist = distFromCenter / currentRadius;
            // Use a very gentle exponential falloff - starts fading immediately from center
            // This creates a soft, light-like appearance with no hard edges
            float radialFalloff = exp(-normalizedDist * normalizedDist * 2.5); // Gaussian-like falloff
            // Apply additional smoothing for ultra-soft edges
            radialFalloff = pow(radialFalloff, 0.6); // Even softer
            
            // Vertical falloff - BRIGHT at top (origin), fade to bottom
            // yNormalized = 1.0 is top/origin (brightest), 0.0 is bottom/target (dimmest)
            // Use a gentler power curve so light extends further down before fading
            float verticalFalloff = pow(yNormalized, 0.4); // Lower power = extends further down
            // Very gentle fade at top edge
            float topEdgeFade = smoothstep(0.9, 1.0, yNormalized);
            verticalFalloff *= (1.0 - topEdgeFade * 0.05); // Minimal fade at very top
            
            // Combine all falloffs with smooth blending
            float alpha = radialFalloff * verticalFalloff * uIntensity;
            
            // Brighter color at top (origin), dimmer at bottom
            // yNormalized = 1.0 is top (brightest), 0.0 is bottom (dimmest)
            float brightnessBoost = mix(0.4, 2.5, pow(yNormalized, 0.6)); // Reduced brightness, extends further down
            vec3 finalColor = uColor * brightnessBoost * (1.0 + uIntensity * 0.5);
            
            // Very low threshold - only discard completely invisible pixels
            // This ensures ultra-soft edges with no visible cutoff
            if (alpha < 0.001) {
              discard;
            }
            
            // Slightly reduced alpha for softer, less intense light
            gl_FragColor = vec4(finalColor, alpha * 0.75);
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false, // Don't write depth for additive blending (prevents artifacts)
        depthTest: true,   // CRITICAL: Test depth to prevent rendering through walls
        depthFunc: THREE.LessEqualDepth, // Standard depth function - only render if depth <= existing
        alphaTest: 0.001   // Very low threshold for ultra-soft edges
      });
      
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      
      // CRITICAL: Ensure beams render AFTER opaque objects (walls) and respect depth
      // Lower renderOrder = renders first, Higher renderOrder = renders last
      // Walls should have renderOrder = 0 (default), beams should have high renderOrder
      beam.renderOrder = 1000; // Very high render order to ensure beams render AFTER all walls
      beam.frustumCulled = true;
      
      // Calculate direction for this beam (spreading outward in cone)
      // Each beam should angle outward from the center
      const targetX = Math.cos(angle) * radius;
      const targetZ = Math.sin(angle) * radius;
      const targetY = targetPosition.y - config.position.y;
      
      // Calculate direction vector (from light source to target)
      // This points DOWNWARD from the light source
      const direction = new THREE.Vector3(targetX, targetY, targetZ).normalize();
      
      // Position beam starting from the light source (top center)
      beam.position.set(0, 0, 0);
      
      // Rotate cylinder to point along the direction
      // Cylinders default to pointing up (0, 1, 0)
      // We want the cylinder to point DOWNWARD, so we rotate from up to -direction
      // This way: local +Y points UP (toward light source/origin), local -Y points DOWN (toward target)
      const up = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion();
      const negatedDirection = direction.clone().negate();
      quaternion.setFromUnitVectors(up, negatedDirection);
      beam.applyQuaternion(quaternion);
      
      // Move beam so it extends from source outward
      // The cylinder center should be at half its length along the direction (toward target)
      const halfLength = beamHeight / 2;
      beam.position.copy(direction.clone().multiplyScalar(halfLength));
      
      this.lightBeams.push(beam);
      this.beamGroup.add(beam);
      
      // Initialize independent flicker state for this beam
      this.beamFlickerStates.push({
        state: 'steady',
        stateStartTime: Date.now() * 0.001,
        stateDuration: 2 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2 // Random phase offset
      });
    }
  }

  getLight(): THREE.SpotLight {
    return this.light;
  }

  getPointLight(): THREE.PointLight {
    return this.pointLight;
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
    // Initialize state machine
    this.stateStartTime = Date.now() * 0.001;
    this.flickerState = 'steady';
    this.stateDuration = 2 + Math.random() * 3; // Start with steady light
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
    this.pointLight.intensity = this.baseIntensity * 0.4;
    this.pointLight.color.setHex(this.baseColor);
  }

  private animate = (): void => {
    if (!this.isAnimating) return;

    const time = Date.now() * 0.001;
    const timeSinceStateStart = time - this.stateStartTime;
    
    // State machine for varied flickering patterns
    if (timeSinceStateStart >= this.stateDuration) {
      // Transition to new state
      const rand = Math.random();
      if (rand < 0.3) {
        // 30% chance: steady light (break)
        this.flickerState = 'steady';
        this.stateDuration = 2 + Math.random() * 4; // 2-6 seconds of steady light
      } else if (rand < 0.5) {
        // 20% chance: sparking moment
        this.flickerState = 'sparking';
        this.stateDuration = 0.5 + Math.random() * 1.5; // 0.5-2 seconds of sparking
      } else if (rand < 0.8) {
        // 30% chance: normal flickering
        this.flickerState = 'flickering';
        this.stateDuration = 1 + Math.random() * 3; // 1-4 seconds of flickering
      } else {
        // 20% chance: break (light dims or goes out briefly)
        this.flickerState = 'break';
        this.stateDuration = 0.3 + Math.random() * 1.2; // 0.3-1.5 seconds break
      }
      this.stateStartTime = time;
    }
    
    // Calculate intensity based on current state
    let intensityMultiplier = 1.0;
    
    switch (this.flickerState) {
      case 'steady':
        // Steady light with very subtle variation
        intensityMultiplier = 0.95 + Math.sin(time * 2) * 0.05;
        break;
        
      case 'flickering':
        // Normal flickering pattern
        const flicker = Math.sin(time * 15 * this.config.flickerSpeed) * 
                        Math.sin(time * 23 * this.config.flickerSpeed) *
                        Math.sin(time * 5 * this.config.flickerSpeed);
        intensityMultiplier = 0.75 + (flicker * 0.25);
        break;
        
      case 'sparking':
        // Intense sparking - rapid bright flashes
        const sparkFreq = 30 + Math.random() * 20; // High frequency
        const spark = Math.sin(time * sparkFreq) * Math.sin(time * sparkFreq * 1.7);
        const sparkIntensity = 1.2 + Math.abs(spark) * 0.8; // 1.2 to 2.0
        intensityMultiplier = sparkIntensity;
        break;
        
      case 'break':
        // Break - light dims significantly or goes out
        const breakProgress = timeSinceStateStart / this.stateDuration;
        if (breakProgress < 0.3) {
          // Fade out
          intensityMultiplier = 1.0 - (breakProgress / 0.3) * 0.9; // Fade to 0.1
        } else if (breakProgress < 0.7) {
          // Stay dim
          intensityMultiplier = 0.1 + Math.random() * 0.2; // 0.1 to 0.3
        } else {
          // Fade back in
          intensityMultiplier = 0.1 + ((breakProgress - 0.7) / 0.3) * 0.9; // Fade back to 1.0
        }
        break;
    }
    
    const finalIntensity = this.baseIntensity * Math.max(0.05, Math.min(2.5, intensityMultiplier));
    this.light.intensity = finalIntensity;
    // Sync point light intensity (at 40% of spot light for ambient-like effect)
    this.pointLight.intensity = finalIntensity * 0.4;
    
    // Color variation - warmer during sparking, cooler during breaks
    if (this.config.colorVariation) {
      let colorShift = 0;
      if (this.flickerState === 'sparking') {
        // Warmer, brighter yellow during sparking
        colorShift = 0.15;
      } else if (this.flickerState === 'break') {
        // Cooler, dimmer during breaks
        colorShift = -0.1;
      } else if (intensityMultiplier > 1.3) {
        // Slight warm shift during bright moments
        colorShift = 0.05;
      }
      
      const r = Math.min(1, Math.max(0, ((this.baseColor >> 16) & 0xff) / 255 + colorShift));
      const g = Math.min(1, Math.max(0, ((this.baseColor >> 8) & 0xff) / 255 + colorShift * 0.8));
      const b = Math.min(1, Math.max(0, (this.baseColor & 0xff) / 255 - colorShift * 0.3));
      this.light.color.setRGB(r, g, b);
      // Sync point light color
      this.pointLight.color.setRGB(r, g, b);
      
      // Update beam colors too
      this.lightBeams.forEach(beam => {
        if (beam.material instanceof THREE.ShaderMaterial) {
          beam.material.uniforms.uColor.value.setRGB(r, g, b);
        } else if (beam.material instanceof THREE.MeshBasicMaterial) {
          beam.material.color.setRGB(r, g, b);
        }
      });
    }
    
    // Position jitter - more during sparking, less during steady/breaks
    let jitterAmount = 0.2;
    if (this.flickerState === 'sparking') {
      jitterAmount = 0.8 * this.config.glitchIntensity; // More jitter during sparking
    } else if (this.flickerState === 'flickering') {
      jitterAmount = 0.4 * this.config.glitchIntensity;
    } else if (this.flickerState === 'break') {
      jitterAmount = 0.1; // Minimal jitter during breaks
    }
    
    this.light.position.x = this.config.position.x + (Math.random() - 0.5) * jitterAmount;
    this.light.position.y = this.config.position.y + (Math.random() - 0.5) * jitterAmount * 0.5;
    this.light.position.z = this.config.position.z + (Math.random() - 0.5) * jitterAmount;
    
    // Update light target position (slight jitter)
    this.light.target.position.x = this.targetPosition.x + (Math.random() - 0.5) * jitterAmount * 0.3;
    this.light.target.position.y = this.targetPosition.y;
    this.light.target.position.z = this.targetPosition.z + (Math.random() - 0.5) * jitterAmount * 0.3;
    
    // Update beam group position to match light
    this.beamGroup.position.copy(this.light.position);
    
    // Update individual beams with independent flickering
    this.lightBeams.forEach((beam, index) => {
      const beamState = this.beamFlickerStates[index];
      if (!beamState) return;
      
      const beamTime = time + beamState.phase; // Add phase offset for variation
      const timeSinceStateStart = beamTime - beamState.stateStartTime;
      
      // Update beam's flicker state independently
      if (timeSinceStateStart >= beamState.stateDuration) {
        const rand = Math.random();
        if (rand < 0.3) {
          beamState.state = 'steady';
          beamState.stateDuration = 2 + Math.random() * 4;
        } else if (rand < 0.5) {
          beamState.state = 'sparking';
          beamState.stateDuration = 0.5 + Math.random() * 1.5;
        } else if (rand < 0.8) {
          beamState.state = 'flickering';
          beamState.stateDuration = 1 + Math.random() * 3;
        } else {
          beamState.state = 'break';
          beamState.stateDuration = 0.3 + Math.random() * 1.2;
        }
        beamState.stateStartTime = beamTime;
      }
      
      // Calculate beam-specific intensity multiplier
      let beamIntensityMultiplier = 1.0;
      
      switch (beamState.state) {
        case 'steady':
          beamIntensityMultiplier = 0.95 + Math.sin(beamTime * 2) * 0.05;
          break;
        case 'flickering':
          const flicker = Math.sin(beamTime * 15 * this.config.flickerSpeed) * 
                          Math.sin(beamTime * 23 * this.config.flickerSpeed) *
                          Math.sin(beamTime * 5 * this.config.flickerSpeed);
          beamIntensityMultiplier = 0.75 + (flicker * 0.25);
          break;
        case 'sparking':
          const sparkFreq = 30 + Math.random() * 20;
          const spark = Math.sin(beamTime * sparkFreq) * Math.sin(beamTime * sparkFreq * 1.7);
          beamIntensityMultiplier = 1.2 + Math.abs(spark) * 0.8;
          break;
        case 'break':
          const breakProgress = timeSinceStateStart / beamState.stateDuration;
          if (breakProgress < 0.3) {
            beamIntensityMultiplier = 1.0 - (breakProgress / 0.3) * 0.9;
          } else if (breakProgress < 0.7) {
            beamIntensityMultiplier = 0.1 + Math.random() * 0.2;
          } else {
            beamIntensityMultiplier = 0.1 + ((breakProgress - 0.7) / 0.3) * 0.9;
          }
          break;
      }
      
      // Apply beam-specific intensity (combine with overall light intensity)
      const overallIntensityRatio = this.light.intensity / this.baseIntensity;
      const finalBeamIntensity = overallIntensityRatio * Math.max(0.05, Math.min(2.5, beamIntensityMultiplier));
      
      if (beam.material instanceof THREE.ShaderMaterial) {
        // Update shader uniforms for intensity and color
        beam.material.uniforms.uIntensity.value = finalBeamIntensity;
        beam.material.uniforms.uColor.value.copy(this.light.color);
        beam.material.uniforms.uTime.value = beamTime;
        
        // Slight scale variation during flicker
        const scale = 0.95 + (finalBeamIntensity * 0.1);
        beam.scale.set(scale, 1, scale);
      } else if (beam.material instanceof THREE.MeshBasicMaterial) {
        // Fallback for non-shader materials
        const baseOpacity = 0.1 + (index % 3) * 0.05;
        beam.material.opacity = Math.min(0.25, baseOpacity * finalBeamIntensity);
        beam.material.color.copy(this.light.color);
        const scale = 0.95 + (finalBeamIntensity * 0.1);
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
    color: 0xff9933,           // Warmer orange-yellow (more orange, less yellow)
    intensity: 8.0,
    position: lightPosition,
    flickerSpeed: 0.8,
    glitchIntensity: 0.6,
    colorVariation: true,
  }, targetPosition);

  scene.add(flickeringLight.getLight());
  scene.add(flickeringLight.getPointLight()); // Add point light for ambient-like illumination
  scene.add(flickeringLight.getLightTarget());
  
  // Add beam group - render AFTER opaque objects so depth testing works properly
  const beamGroup = flickeringLight.getBeamGroup();
  beamGroup.renderOrder = 1000; // Very high render order to ensure beams render AFTER all walls
  scene.add(beamGroup);
  
  console.log('   Light beam group added with', flickeringLight.getBeamGroup().children.length, 'beams');
  
  flickeringLight.start();

  return flickeringLight;
}
