import * as THREE from "three";

/**
 * Creates graffiti textures using canvas
 */
function createGraffitiTexture(text: string, width: number = 512, height: number = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  // Transparent background
  ctx.clearRect(0, 0, width, height);
  
  // Random graffiti styles
  const styles = [
    { font: 'bold 48px Arial', color: '#ff0000', stroke: '#000000', strokeWidth: 2 },
    { font: 'bold 36px Arial', color: '#00ff00', stroke: '#000000', strokeWidth: 2 },
    { font: 'bold 42px Arial', color: '#ffff00', stroke: '#000000', strokeWidth: 2 },
    { font: 'bold 40px Arial', color: '#ff00ff', stroke: '#000000', strokeWidth: 2 },
    { font: 'bold 38px Arial', color: '#00ffff', stroke: '#000000', strokeWidth: 2 },
  ];
  
  const style = styles[Math.floor(Math.random() * styles.length)];
  
  // Draw text with outline
  ctx.font = style.font;
  ctx.fillStyle = style.color;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.strokeWidth;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Add some rotation for authenticity
  const rotation = (Math.random() - 0.5) * 0.3;
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(rotation);
  
  // Draw stroke first, then fill
  ctx.strokeText(text, 0, 0);
  ctx.fillText(text, 0, 0);
  
  ctx.restore();
  
  // Add some random spray paint dots and drips
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = Math.random() * 2 + 0.5;
    ctx.fillStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.5)`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Add paint drips (vertical streaks)
  for (let i = 0; i < 3; i++) {
    const x = Math.random() * width;
    const startY = Math.random() * height * 0.5;
    const length = Math.random() * 20 + 10;
    ctx.strokeStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.4)`;
    ctx.lineWidth = Math.random() * 2 + 1;
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x + (Math.random() - 0.5) * 3, startY + length);
    ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  
  return texture;
}

/**
 * Creates a simple tag/symbol graffiti texture
 */
function createTagTexture(width: number = 256, height: number = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  ctx.clearRect(0, 0, width, height);
  
  // Random tag symbols
  const symbols = ['✗', '⚡', '★', '▲', '●', '◆', '■'];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  
  const colors = ['#ff0000', '#00ff00', '#ffff00', '#ff00ff', '#00ffff', '#ffffff'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  ctx.font = 'bold 120px Arial';
  ctx.fillStyle = color;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const rotation = (Math.random() - 0.5) * 0.5;
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(rotation);
  
  ctx.strokeText(symbol, 0, 0);
  ctx.fillText(symbol, 0, 0);
  ctx.restore();
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  
  return texture;
}

/**
 * Creates a graffiti decal mesh that can be applied to a surface
 */
function createGraffitiDecal(
  mesh: THREE.Mesh,
  position: THREE.Vector3,
  normal: THREE.Vector3,
  size: THREE.Vector2,
  texture: THREE.Texture
): THREE.Mesh | null {
  try {
    // Create decal geometry
    const decalGeometry = new THREE.PlaneGeometry(size.x, size.y);
    
    // Create decal material with slight emissive glow for visibility
    const decalMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
      // Add slight emissive to make graffiti stand out in dark lighting
      emissive: new THREE.Color(0x000000),
      emissiveMap: texture,
    });
    
    // Create decal mesh
    const decal = new THREE.Mesh(decalGeometry, decalMaterial);
    
    // Create a proper orientation matrix
    // Use lookAt to orient the decal towards the normal
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3();
    
    // Check if normal is parallel to up vector
    if (Math.abs(normal.dot(up)) > 0.99) {
      // Use a different up vector if normal is vertical
      up.set(1, 0, 0);
    }
    
    right.crossVectors(up, normal).normalize();
    const correctedUp = new THREE.Vector3().crossVectors(normal, right).normalize();
    
    // Create matrix from basis vectors
    const matrix = new THREE.Matrix4();
    matrix.makeBasis(right, correctedUp, normal);
    decal.setRotationFromMatrix(matrix);
    
    // Position the decal
    decal.position.copy(position);
    
    // Add slight offset along normal to prevent z-fighting
    decal.position.add(normal.clone().multiplyScalar(0.02));
    
    // Random rotation around normal axis for variety
    const randomRotation = (Math.random() - 0.5) * Math.PI * 0.3; // ±30 degrees
    decal.rotateOnAxis(normal, randomRotation);
    
    // Set render order to appear on top
    decal.renderOrder = 100;
    
    return decal;
  } catch (error) {
    console.error('Error creating graffiti decal:', error);
    return null;
  }
}

/**
 * Finds wall meshes in the model (meshes with plastered wall materials)
 */
function findWallMeshes(model: THREE.Group): THREE.Mesh[] {
  const wallMeshes: THREE.Mesh[] = [];
  const wallMaterialNames = ['intonaco rosa', 'intonaco chiaro', 'intonaco grigio'];
  
  model.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material) {
      const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      if (material.name && wallMaterialNames.includes(material.name)) {
        wallMeshes.push(obj);
      }
    }
  });
  
  return wallMeshes;
}

/**
 * Gets a random point on a mesh surface
 */
function getRandomPointOnMesh(mesh: THREE.Mesh): { position: THREE.Vector3; normal: THREE.Vector3 } | null {
  const geometry = mesh.geometry;
  if (!geometry.attributes.position) return null;
  
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const indices = geometry.index;
  
  // Calculate triangle count
  let triangleCount: number;
  let getVertexIndex: (triangleIndex: number, vertexInTriangle: number) => number;
  
  if (indices) {
    triangleCount = indices.count / 3;
    getVertexIndex = (triIdx: number, vertIdx: number) => {
      return indices.getX(triIdx * 3 + vertIdx);
    };
  } else {
    triangleCount = positions.count / 3;
    getVertexIndex = (triIdx: number, vertIdx: number) => {
      return triIdx * 3 + vertIdx;
    };
  }
  
  if (triangleCount === 0) return null;
  
  // Get random triangle
  const randomTriangle = Math.floor(Math.random() * triangleCount);
  const i0 = getVertexIndex(randomTriangle, 0);
  const i1 = getVertexIndex(randomTriangle, 1);
  const i2 = getVertexIndex(randomTriangle, 2);
  
  // Get triangle vertices in local space
  const v0 = new THREE.Vector3(
    positions.getX(i0),
    positions.getY(i0),
    positions.getZ(i0)
  );
  const v1 = new THREE.Vector3(
    positions.getX(i1),
    positions.getY(i1),
    positions.getZ(i1)
  );
  const v2 = new THREE.Vector3(
    positions.getX(i2),
    positions.getY(i2),
    positions.getZ(i2)
  );
  
  // Calculate normal from triangle (always compute from geometry)
  const edge1 = new THREE.Vector3().subVectors(v1, v0);
  const edge2 = new THREE.Vector3().subVectors(v2, v0);
  let normal = new THREE.Vector3().crossVectors(edge1, edge2);
  
  // If we have normals from geometry, try to use them (weighted average)
  if (normals) {
    const n0 = new THREE.Vector3(
      normals.getX(i0),
      normals.getY(i0),
      normals.getZ(i0)
    );
    const n1 = new THREE.Vector3(
      normals.getX(i1),
      normals.getY(i1),
      normals.getZ(i1)
    );
    const n2 = new THREE.Vector3(
      normals.getX(i2),
      normals.getY(i2),
      normals.getZ(i2)
    );
    
    // Use computed normal if geometry normal is invalid
    if (normal.length() > 0.001) {
      normal.normalize();
    } else {
      // Fallback to average of vertex normals
      normal.addVectors(n0, n1).add(n2).normalize();
    }
  } else {
    normal.normalize();
  }
  
  // Get random point on triangle using proper barycentric coordinates
  let u = Math.random();
  let v = Math.random();
  
  // Ensure we're inside the triangle
  if (u + v > 1) {
    u = 1 - u;
    v = 1 - v;
  }
  
  const w = 1 - u - v;
  
  // Calculate position in local space
  const localPosition = new THREE.Vector3()
    .addScaledVector(v0, u)
    .addScaledVector(v1, v)
    .addScaledVector(v2, w);
  
  // Transform to world space
  localPosition.applyMatrix4(mesh.matrixWorld);
  normal.transformDirection(mesh.matrixWorld).normalize();
  
  return { position: localPosition, normal };
}

/**
 * Adds graffiti to temple walls
 */
export function addGraffitiToWalls(scene: THREE.Scene, model: THREE.Group, count: number = 8): void {
  const wallMeshes = findWallMeshes(model);
  
  if (wallMeshes.length === 0) {
    console.warn('No wall meshes found for graffiti');
    return;
  }
  
  console.log(`Found ${wallMeshes.length} wall meshes, adding ${count} graffiti pieces...`);
  
  const graffitiTexts = [
    'TEMPIO', 'ROMA', '2024', 'LOVE', 'PEACE', 'FREE', 'ART', 'REBEL',
    'VIVA', 'LIBERTA', 'ROMA', 'ITALIA', 'STREET', 'ART', 'GRAFFITI'
  ];
  
  for (let i = 0; i < count; i++) {
    // Pick random wall mesh
    const wallMesh = wallMeshes[Math.floor(Math.random() * wallMeshes.length)];
    
    // Get random point on wall
    const pointData = getRandomPointOnMesh(wallMesh);
    if (!pointData) continue;
    
    // Decide between text graffiti or tag
    const isTag = Math.random() < 0.4; // 40% tags, 60% text
    
    let texture: THREE.Texture;
    let size: THREE.Vector2;
    
    if (isTag) {
      texture = createTagTexture(256, 256);
      size = new THREE.Vector2(2, 2); // Smaller tags
    } else {
      const text = graffitiTexts[Math.floor(Math.random() * graffitiTexts.length)];
      texture = createGraffitiTexture(text, 512, 256);
      size = new THREE.Vector2(4, 2); // Larger text graffiti
    }
    
    // Create decal
    const decal = createGraffitiDecal(
      wallMesh,
      pointData.position,
      pointData.normal,
      size,
      texture
    );
    
    if (decal) {
      scene.add(decal);
      console.log(`Added graffiti ${i + 1}/${count}`);
    }
  }
  
  console.log('✅ Graffiti added to temple walls');
}
