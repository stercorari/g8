import * as THREE from "three";
import { gsap } from "gsap";

/**
 * Creates a ghostly image plane inside the scene with transparency and glow effects
 */
export function createGhostlyImage(
  scene: THREE.Scene,
  imagePath: string,
  position: THREE.Vector3,
  size: { width: number; height: number } = { width: 10, height: 10 }
): THREE.Mesh {
  // Create texture loader
  const textureLoader = new THREE.TextureLoader();
  
  // Default aspect ratio
  let aspect = 1;
  let finalWidth = size.width;
  let finalHeight = size.height;
  
  // Reference to plane (will be set after creation)
  let planeRef: THREE.Mesh | null = null;
  
  // Load the image texture with callback to adjust aspect ratio
  const texture = textureLoader.load(imagePath, (loadedTexture) => {
    // Calculate aspect ratio to maintain image proportions
    if (loadedTexture.image && loadedTexture.image.width && loadedTexture.image.height) {
      aspect = loadedTexture.image.width / loadedTexture.image.height;
      finalWidth = size.width;
      finalHeight = size.width / aspect;
      
      // Update geometry to match image aspect ratio
      if (planeRef) {
        planeRef.geometry.dispose();
        planeRef.geometry = new THREE.PlaneGeometry(finalWidth, finalHeight);
      }
    }
  });

  // Create a custom shader material for ghostly effect
  const ghostlyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0 },
      uOpacity: { value: 0.1 }, // Almost invisible
      uGlowIntensity: { value: 0.8 }, // Subtle glow
      uGlowColor: { value: new THREE.Color(0x88aaff) }, // Soft blue-white glow
      uFlicker: { value: 1.0 }, // Flicker intensity multiplier
      uDistortion: { value: 0.0 }, // Distortion amount
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPosition;
      
      void main() {
        vUv = uv;
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uGlowIntensity;
      uniform vec3 uGlowColor;
      uniform float uFlicker;
      uniform float uDistortion;
      
      varying vec2 vUv;
      varying vec3 vPosition;
      
      // Simple noise function for distortion
      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      // Smooth noise
      float smoothNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float a = noise(i);
        float b = noise(i + vec2(1.0, 0.0));
        float c = noise(i + vec2(0.0, 1.0));
        float d = noise(i + vec2(1.0, 1.0));
        
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      
      void main() {
        // Distort UV coordinates for vanishing spirit effect
        vec2 distortedUv = vUv;
        
        // Add wave distortion
        float waveX = sin(vUv.y * 10.0 + uTime * 2.0) * uDistortion * 0.05;
        float waveY = cos(vUv.x * 8.0 + uTime * 1.5) * uDistortion * 0.05;
        
        // Add noise-based distortion
        float noiseDistortion = smoothNoise(vUv * 5.0 + uTime * 0.5) - 0.5;
        distortedUv.x += waveX + noiseDistortion * uDistortion * 0.03;
        distortedUv.y += waveY + noiseDistortion * uDistortion * 0.03;
        
        // Sample texture with distortion
        vec4 texColor = texture2D(uTexture, distortedUv);
        
        // Create a pulsing glow effect
        float pulse = sin(uTime * 2.0) * 0.1 + 1.0;
        
        // Add glow around the edges
        float edgeGlow = 1.0 - length(vUv - 0.5) * 2.0;
        edgeGlow = max(0.0, edgeGlow);
        edgeGlow = pow(edgeGlow, 2.0);
        
        // Vary opacity across the image for vanishing effect
        float vanishingMask = smoothNoise(vUv * 3.0 + uTime * 0.3);
        vanishingMask = vanishingMask * 0.5 + 0.5; // Normalize to 0-1
        vanishingMask = pow(vanishingMask, 1.5); // Make it more patchy
        
        // Make texture very faint, mostly just glow
        vec3 textureColor = texColor.rgb * 0.15 * uFlicker; // Very faint texture with flicker
        vec3 glow = uGlowColor * edgeGlow * uGlowIntensity * pulse;
        vec3 finalColor = textureColor + glow;
        
        // Apply very low transparency with flicker and vanishing mask
        float baseAlpha = texColor.a * uOpacity * uFlicker;
        float alpha = baseAlpha * (0.7 + vanishingMask * 0.3) * (0.9 + pulse * 0.1);
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false, // Important for transparency
    blending: THREE.AdditiveBlending, // Creates glow effect
  });

  // Create plane geometry (will be updated in texture callback if needed)
  const geometry = new THREE.PlaneGeometry(finalWidth, finalHeight);
  const plane = new THREE.Mesh(geometry, ghostlyMaterial);
  planeRef = plane; // Set reference for callback
  
  // Position the plane
  plane.position.copy(position);
  
  // Make it face the camera initially (can be adjusted)
  plane.lookAt(position.clone().add(new THREE.Vector3(0, 0, 1)));
  
  // Rotate 90 degrees clockwise around Z-axis (after lookAt)
  plane.rotateY(-Math.PI / 2);
  
  // Add to scene
  scene.add(plane);
  
  // Animate the shader time uniform for pulsing effect
  const clock = new THREE.Clock();
  const updateGhostlyEffect = () => {
    ghostlyMaterial.uniforms.uTime.value = clock.getElapsedTime();
    requestAnimationFrame(updateGhostlyEffect);
  };
  updateGhostlyEffect();
  
  // Random flicker effect - occasionally make it more visible
  const triggerFlicker = () => {
    const delay = Math.random() * 3000 + 2000; // Random delay between 2-5 seconds
    setTimeout(() => {
      // Flicker up briefly
      gsap.to(ghostlyMaterial.uniforms.uFlicker, {
        value: 2.5,
        duration: 0.15,
        ease: "power2.out",
        onComplete: () => {
          gsap.to(ghostlyMaterial.uniforms.uFlicker, {
            value: 1.0,
            duration: 0.3,
            ease: "power2.in"
          });
        }
      });
      triggerFlicker(); // Schedule next flicker
    }, delay);
  };
  triggerFlicker();
  
  // Animate distortion for vanishing spirit effect
  gsap.to(ghostlyMaterial.uniforms.uDistortion, {
    value: 1.0,
    duration: 2,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });
  
  // Add subtle floating animation
  gsap.to(plane.position, {
    y: "+=0.5",
    duration: 3,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });
  
  // Add subtle rotation animation
  gsap.to(plane.rotation, {
    z: "+=0.05",
    duration: 4,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });
  
  return plane;
}
