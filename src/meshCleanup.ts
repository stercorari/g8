import * as THREE from "three";

/* ------------------------------------------------------------------
   MESH ANALYSIS & CLEANUP
------------------------------------------------------------------ */

export interface MeshInfo {
  mesh: THREE.Mesh;
  name: string;
  size: THREE.Vector3;
  maxDim: number;
  minDim: number;
  midDim: number;
  volume: number;
  flatness: number;
}

export function analyzeMeshes(model: THREE.Group): MeshInfo[] {
  const allMeshes: MeshInfo[] = [];
  const tempBox = new THREE.Box3();
  const tempSize = new THREE.Vector3();
  
  model.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      // Calculate bounding box for this mesh
      tempBox.setFromObject(obj);
      tempSize.copy(tempBox.getSize(tempSize));
      
      const maxDim = Math.max(tempSize.x, tempSize.y, tempSize.z);
      const minDim = Math.min(tempSize.x, tempSize.y, tempSize.z);
      const midDim = tempSize.x + tempSize.y + tempSize.z - maxDim - minDim;
      const volume = tempSize.x * tempSize.y * tempSize.z;
      
      allMeshes.push({
        mesh: obj,
        name: obj.name || 'unnamed',
        size: tempSize.clone(),
        maxDim: maxDim,
        minDim: minDim,
        midDim: midDim,
        volume: volume,
        flatness: minDim / maxDim
      });
    }
  });
  
  // Sort by size (largest first) and print
  allMeshes.sort((a, b) => b.maxDim - a.maxDim);
  // console.log('\n=== ALL MESHES (sorted by largest dimension) ===');
  // allMeshes.forEach((meshInfo, index) => {
  //   console.log(`${index + 1}. ${meshInfo.name}`);
  //   console.log(`   Size: ${meshInfo.size.x.toFixed(2)} x ${meshInfo.size.y.toFixed(2)} x ${meshInfo.size.z.toFixed(2)}`);
  //   console.log(`   Max dimension: ${meshInfo.maxDim.toFixed(2)}`);
  //   console.log(`   Flatness ratio: ${(meshInfo.flatness * 100).toFixed(1)}%`);
  //   console.log(`   Volume: ${meshInfo.volume.toFixed(2)}`);
  //   console.log('');
  // });
  
  return allMeshes;
}

export function cleanupMeshes(_model: THREE.Group, allMeshes: MeshInfo[], _modelScale: number): void {
  // Calculate center of all meshes
  const tempBox = new THREE.Box3();
  const meshCenters: THREE.Vector3[] = [];
  const meshDistances: number[] = [];
  
  allMeshes.forEach(meshInfo => {
    tempBox.setFromObject(meshInfo.mesh);
    const center = tempBox.getCenter(new THREE.Vector3());
    meshCenters.push(center);
  });
  
  // Calculate overall centroid
  const centroid = new THREE.Vector3();
  meshCenters.forEach(center => centroid.add(center));
  centroid.divideScalar(meshCenters.length);
  
  // Calculate distances from centroid
  allMeshes.forEach((_, index) => {
    const distance = meshCenters[index].distanceTo(centroid);
    meshDistances.push(distance);
  });
  
  // Calculate average and standard deviation to identify outliers
  const avgDistance = meshDistances.reduce((a, b) => a + b, 0) / meshDistances.length;
  const variance = meshDistances.reduce((sum, dist) => sum + Math.pow(dist - avgDistance, 2), 0) / meshDistances.length;
  const stdDev = Math.sqrt(variance);
  const threshold = avgDistance + 2 * stdDev; // Remove meshes more than 2 standard deviations away
  
  console.log(`\n=== DISTANCE ANALYSIS ===`);
  console.log(`Centroid: (${centroid.x.toFixed(2)}, ${centroid.y.toFixed(2)}, ${centroid.z.toFixed(2)})`);
  console.log(`Average distance: ${avgDistance.toFixed(2)}`);
  console.log(`Standard deviation: ${stdDev.toFixed(2)}`);
  console.log(`Outlier threshold: ${threshold.toFixed(2)}`);
  
  // Filter out large flat planes and distant meshes
  const meshesToRemove: THREE.Mesh[] = [];
  
  allMeshes.forEach((meshInfo, index) => {
    const isFlat = meshInfo.flatness < 0.01; // One dimension is < 15% of the largest
    // const isLarge = meshInfo.maxDim > modelScale * 0.3; // Mesh is > 30% of model's largest dimension
    const isLarge = false;
    const isDistant = meshDistances[index] > threshold; // Mesh is far from the main model
    
    if (/* isFlat || isLarge || */ isDistant) {
      meshesToRemove.push(meshInfo.mesh);
      // const reason = isDistant ? 'distant from main model' : 'large flat plane';
      // console.log(`🗑️ Removing ${reason}:`, meshInfo.name, 
      //   `distance: ${meshDistances[index].toFixed(2)}, size:`, meshInfo.size);
    } else {
      meshInfo.mesh.castShadow = true;
      meshInfo.mesh.receiveShadow = true;
    }
  });
  
  // Remove the identified meshes
  meshesToRemove.forEach(mesh => {
    if (mesh.parent) {
      mesh.parent.remove(mesh);
    }
  });
}
