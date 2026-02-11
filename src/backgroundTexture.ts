import * as THREE from "three";

/**
 * Loads and applies background texture from blusfondo folder
 * Multiplies the texture over the dark blue background for a subtle effect
 */
export function setupBackgroundTexture(scene: THREE.Scene): void {
  // Base dark blue background color (Nighthawks-inspired)
  const baseColor = new THREE.Color(0x0f0f1a);
  
  // Load background texture from blusfondo folder
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(`${import.meta.env.BASE_URL}materials/blusfondo/PaintedWood001_2K-JPG_Color.jpg`, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    
    // Create canvas to blend texture with base color using multiply mode
    const canvas = document.createElement('canvas');
    canvas.width = texture.image.width;
    canvas.height = texture.image.height;
    const ctx = canvas.getContext('2d')!;
    
    // First, fill with the base dark blue color
    ctx.fillStyle = `rgb(${Math.floor(baseColor.r * 255)}, ${Math.floor(baseColor.g * 255)}, ${Math.floor(baseColor.b * 255)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Use overlay blend mode - it preserves texture detail while darkening
    // Overlay combines multiply (dark areas) and screen (light areas) for better texture visibility
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 1; // Increased opacity to make texture more visible
    ctx.drawImage(texture.image, 0, 0);
    
    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    
    // Very light overlay to maintain dark mood but preserve texture visibility
    ctx.fillStyle = 'rgba(15, 15, 26, 0.2)'; // Light overlay to keep it dark but not uniform
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Create new texture from the blended canvas
    const blendedTexture = new THREE.CanvasTexture(canvas);
    blendedTexture.colorSpace = THREE.SRGBColorSpace;
    scene.background = blendedTexture;
  }, undefined, (err) => {
    console.error('Failed to load background texture:', err);
    // Fallback to solid color if texture fails to load
    scene.background = baseColor;
  });
}
