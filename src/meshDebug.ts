import * as THREE from "three";

/* ------------------------------------------------------------------
   MESH DEBUGGING & FIXES
------------------------------------------------------------------ */

export interface GlitchDetectionConfig {
  // Size thresholds (relative to main model)
  tinySizeThreshold: number;        // Remove meshes smaller than this % of main model
  smallSizeThreshold: number;       // Consider meshes smaller than this for pattern detection
  distantSizeThreshold: number;    // Remove distant meshes smaller than this %
  
  // Volume thresholds
  tinyVolumeThreshold: number;      // Remove meshes with volume smaller than this
  smallVolumeThreshold: number;     // Consider meshes with volume smaller than this
  
  // Distance thresholds (relative to main model size)
  farDistanceThreshold: number;     // Distance from main cluster to consider "far"
  patternDistanceThreshold: number; // Distance to group meshes into patterns
  
  // Geometry complexity
  lowPolyVertexThreshold: number;   // Consider meshes with fewer vertices as artifacts
  lowPolyTriangleThreshold: number;  // Consider meshes with fewer triangles as artifacts
  
  // Pattern detection
  minPatternSize: number;           // Minimum number of meshes to form a pattern
}

export const DEFAULT_GLITCH_CONFIG: GlitchDetectionConfig = {
  tinySizeThreshold: 0.0015,        // 0.15% of main model (slightly more aggressive)
  smallSizeThreshold: 0.003,       // 0.3% for pattern detection
  distantSizeThreshold: 0.015,     // 1.5% for distant meshes
  
  tinyVolumeThreshold: 0.0002,      // Very small volume
  smallVolumeThreshold: 0.002,     // Small volume for pattern detection
  
  farDistanceThreshold: 0.25,        // 25% of main model size away
  patternDistanceThreshold: 0.12,    // 12% for grouping patterns
  
  lowPolyVertexThreshold: 8,        // Fewer than 8 vertices
  lowPolyTriangleThreshold: 4,       // Fewer than 4 triangles
  
  minPatternSize: 3,                // 3+ meshes form a pattern
};

export function detectAndFixGlitches(model: THREE.Group, config: GlitchDetectionConfig = DEFAULT_GLITCH_CONFIG): void {
  console.log('\n=== DETECTING GLITCHES ===');
  
  const allMeshes: THREE.Mesh[] = [];
  model.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      allMeshes.push(obj);
    }
  });
  
  console.log(`Total meshes: ${allMeshes.length}`);
  
  // Get main model scale first
  const mainBox = new THREE.Box3().setFromObject(model);
  const mainSize = mainBox.getSize(new THREE.Vector3());
  const mainMaxDim = Math.max(mainSize.x, mainSize.y, mainSize.z);
  const mainCenter = mainBox.getCenter(new THREE.Vector3());
  console.log(`Main model size: ${mainSize.x.toFixed(2)} x ${mainSize.y.toFixed(2)} x ${mainSize.z.toFixed(2)}, max: ${mainMaxDim.toFixed(2)}`);
  
  // 1. Detect very small meshes that might cause glitches (MORE AGGRESSIVE)
  const tempBox = new THREE.Box3();
  const tempSize = new THREE.Vector3();
  const verySmallMeshes: THREE.Mesh[] = [];
  
  allMeshes.forEach((mesh) => {
    tempBox.setFromObject(mesh);
    tempSize.copy(tempBox.getSize(tempSize));
    const maxSize = Math.max(tempSize.x, tempSize.y, tempSize.z);
    const volume = tempSize.x * tempSize.y * tempSize.z;
    
    // Check geometry complexity
    let vertexCount = 0;
    let triangleCount = 0;
    if (mesh.geometry) {
      if (mesh.geometry.attributes.position) {
        vertexCount = mesh.geometry.attributes.position.count;
      }
      if (mesh.geometry.index) {
        triangleCount = mesh.geometry.index.count / 3;
      } else if (mesh.geometry.attributes.position) {
        triangleCount = mesh.geometry.attributes.position.count / 3;
      }
    }
    
    // Use configurable thresholds
    const relativeSize = maxSize / mainMaxDim;
    const center = tempBox.getCenter(new THREE.Vector3());
    const distanceFromMain = center.distanceTo(mainCenter);
    
    // Remove meshes that meet any of these criteria:
    // 1. Extremely tiny (size AND volume thresholds)
    // 2. Far from main cluster AND tiny
    // 3. Extremely low poly AND tiny
    const isExtremelyTiny = relativeSize < config.tinySizeThreshold && volume < config.tinyVolumeThreshold;
    const isFarAndTiny = distanceFromMain > mainMaxDim * config.farDistanceThreshold && 
                        relativeSize < config.smallSizeThreshold && volume < config.smallVolumeThreshold;
    const isExtremeLowPoly = (vertexCount < config.lowPolyVertexThreshold || triangleCount < config.lowPolyTriangleThreshold) && 
                            relativeSize < config.smallSizeThreshold && volume < config.smallVolumeThreshold;
    
    if (isExtremelyTiny || isFarAndTiny || isExtremeLowPoly) {
      verySmallMeshes.push(mesh);
      console.log(`⚠️  Very small mesh detected: ${mesh.name || 'unnamed'}, size: ${tempSize.x.toFixed(4)} x ${tempSize.y.toFixed(4)} x ${tempSize.z.toFixed(4)}, relative: ${(relativeSize * 100).toFixed(3)}%, vertices: ${vertexCount}, triangles: ${triangleCount}, distance: ${distanceFromMain.toFixed(2)}`);
    }
  });
  
  // 2. Detect potential z-fighting (overlapping meshes)
  const overlappingPairs: Array<{ mesh1: THREE.Mesh; mesh2: THREE.Mesh; overlap: number }> = [];
  
  for (let i = 0; i < allMeshes.length; i++) {
    for (let j = i + 1; j < allMeshes.length; j++) {
      const mesh1 = allMeshes[i];
      const mesh2 = allMeshes[j];
      
      const box1 = new THREE.Box3().setFromObject(mesh1);
      const box2 = new THREE.Box3().setFromObject(mesh2);
      
      // Check if bounding boxes overlap significantly
      if (box1.intersectsBox(box2)) {
        const intersection = box1.intersect(box2);
        const intersectionSize = intersection.getSize(new THREE.Vector3());
        const volume1 = box1.getSize(new THREE.Vector3());
        const volume2 = box2.getSize(new THREE.Vector3());
        const overlapRatio = (intersectionSize.x * intersectionSize.y * intersectionSize.z) / 
                            Math.min(volume1.x * volume1.y * volume1.z, volume2.x * volume2.y * volume2.z);
        
        if (overlapRatio > 0.8) { // More than 80% overlap
          overlappingPairs.push({
            mesh1,
            mesh2,
            overlap: overlapRatio
          });
        }
      }
    }
  }
  
  if (overlappingPairs.length > 0) {
    console.log(`\n⚠️  Found ${overlappingPairs.length} potentially overlapping mesh pairs (z-fighting risk):`);
    overlappingPairs.forEach((pair, idx) => {
      // console.log(`   ${idx + 1}. ${pair.mesh1.name || 'unnamed'} <-> ${pair.mesh2.name || 'unnamed'} (${(pair.overlap * 100).toFixed(1)}% overlap)`);
    });
  }
  
  // 3. Fix z-fighting by adding polygon offset
  allMeshes.forEach((mesh) => {
    if (mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((mat) => {
        if (mat instanceof THREE.MeshStandardMaterial || 
            mat instanceof THREE.MeshPhysicalMaterial ||
            mat instanceof THREE.MeshPhongMaterial) {
          mat.polygonOffset = true;
          mat.polygonOffsetFactor = 1;
          mat.polygonOffsetUnits = 1;
        }
      });
    }
  });
  
  // 4. Remove very small glitchy meshes (do this first)
  if (verySmallMeshes.length > 0) {
    console.log(`\n🗑️  Removing ${verySmallMeshes.length} very small glitchy meshes`);
    verySmallMeshes.forEach((mesh) => {
      if (mesh.parent) {
        // const name = mesh.name || 'unnamed';
        mesh.parent.remove(mesh);
        // console.log(`   Removed: ${name}`);
      }
    });
  }
  
  // 5. Detect and remove small meshes that form lines/patterns (repetitive glitches) - MORE AGGRESSIVE
  const linePatternMeshes: THREE.Mesh[] = [];
  const meshPositions: Array<{ mesh: THREE.Mesh; center: THREE.Vector3; size: number }> = [];
  
  allMeshes.forEach((mesh) => {
    tempBox.setFromObject(mesh);
    const center = tempBox.getCenter(new THREE.Vector3());
    tempSize.copy(tempBox.getSize(tempSize));
    const volume = tempSize.x * tempSize.y * tempSize.z;
    const maxSize = Math.max(tempSize.x, tempSize.y, tempSize.z);
    const relativeSize = maxSize / mainMaxDim;
    
    // Use configurable thresholds for pattern detection
    const distanceFromMain = center.distanceTo(mainCenter);
    const isTinyAndDistant = (volume < config.smallVolumeThreshold || relativeSize < config.smallSizeThreshold) && 
                            distanceFromMain > mainMaxDim * config.patternDistanceThreshold;
    
    if (isTinyAndDistant) {
      meshPositions.push({ mesh, center, size: maxSize });
    }
  });
  
  // Group small meshes by proximity to detect line patterns
  if (meshPositions.length > 0) {
    console.log(`\n🔍 Analyzing ${meshPositions.length} small meshes for line patterns...`);
    const clusters: THREE.Mesh[][] = [];
    const processed = new Set<THREE.Mesh>();
    
    meshPositions.forEach(({ mesh, center }) => {
      if (processed.has(mesh)) return;
      
      const cluster = [mesh];
      processed.add(mesh);
      
      // Find nearby small meshes - increased distance threshold
      meshPositions.forEach(({ mesh: otherMesh, center: otherCenter }) => {
        if (processed.has(otherMesh)) return;
        
        const distance = center.distanceTo(otherCenter);
        // Use configurable threshold to catch diagonal lines
        if (distance < mainMaxDim * config.patternDistanceThreshold) {
          cluster.push(otherMesh);
          processed.add(otherMesh);
        }
      });
      
      // Use configurable minimum pattern size
      if (cluster.length >= config.minPatternSize) {
        clusters.push(cluster);
        linePatternMeshes.push(...cluster);
      }
    });
    
    if (linePatternMeshes.length > 0) {
      console.log(`\n⚠️  Found ${clusters.length} potential glitch patterns (${linePatternMeshes.length} meshes)`);
      console.log(`🗑️  Removing glitch pattern meshes...`);
      linePatternMeshes.forEach((mesh) => {
        if (mesh.parent) {
          // const name = mesh.name || 'unnamed';
          mesh.parent.remove(mesh);
          // console.log(`   Removed pattern mesh: ${name}`);
        }
      });
    }
  }
  
  // 6. Remove meshes that are far from the main cluster (more aggressive)
  const distantMeshes: THREE.Mesh[] = [];
  
  allMeshes.forEach((mesh) => {
    if (verySmallMeshes.includes(mesh) || linePatternMeshes.includes(mesh)) return;
    
    tempBox.setFromObject(mesh);
    const center = tempBox.getCenter(new THREE.Vector3());
    const distance = center.distanceTo(mainCenter);
    
    // Remove meshes that are far from main cluster using configurable thresholds
    if (distance > mainMaxDim * config.farDistanceThreshold) {
      tempSize.copy(tempBox.getSize(tempSize));
      const maxSize = Math.max(tempSize.x, tempSize.y, tempSize.z);
      const relativeSize = maxSize / mainMaxDim;
      // Only remove if they're small relative to main model
      if (relativeSize < config.distantSizeThreshold) {
        distantMeshes.push(mesh);
      }
    }
  });
  
  if (distantMeshes.length > 0) {
    console.log(`\n🗑️  Removing ${distantMeshes.length} distant small meshes...`);
    distantMeshes.forEach((mesh) => {
      if (mesh.parent) {
        // const name = mesh.name || 'unnamed';
        mesh.parent.remove(mesh);
        // console.log(`   Removed distant mesh: ${name}`);
      }
    });
  }
  
  // 6. Enable depth testing and set depth bias
  allMeshes.forEach((mesh) => {
    mesh.renderOrder = 0;
  });
  
  console.log('\n✅ Glitch detection and fixes applied');
}

export function enableDepthPrecision(renderer: THREE.WebGLRenderer): void {
  // Improve depth buffer precision
  const gl = renderer.getContext() as WebGLRenderingContext;
  if (gl) {
    // Enable depth testing
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    // Use higher precision depth buffer if available
    gl.getExtension('WEBGL_depth_texture');
  }
}
