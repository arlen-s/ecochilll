import * as THREE from 'three';

export interface CampusBuildingOptions {
  id: string;
  label: string;
  kind: 'teaching' | 'library' | 'laboratory';
  width: number;
  height: number;
  depth: number;
  position: [number, number, number];
}

const material = (color: string, emissive: string, intensity: number, metalness = 0.28) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    metalness,
    roughness: 0.55,
  });

const block = (
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  surface: THREE.Material,
) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), surface);
  mesh.name = name;
  mesh.position.set(...position);
  return mesh;
};

type FacadeSide = 'front' | 'back' | 'left' | 'right';

interface WindowPlacement {
  x: number;
  y: number;
  z: number;
  rotation: number;
  width: number;
  height: number;
  lit: boolean;
}

const windowFrameGeometry = () => {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, -0.5);
  shape.lineTo(0.5, -0.5);
  shape.lineTo(0.5, 0.5);
  shape.lineTo(-0.5, 0.5);
  shape.closePath();

  const opening = new THREE.Path();
  opening.moveTo(-0.38, -0.38);
  opening.lineTo(-0.38, 0.38);
  opening.lineTo(0.38, 0.38);
  opening.lineTo(0.38, -0.38);
  opening.closePath();
  shape.holes.push(opening);

  return new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false });
};

const addWindows = (
  group: THREE.Group,
  options: CampusBuildingOptions,
  darkGlass: THREE.MeshStandardMaterial,
  litGlass: THREE.MeshStandardMaterial,
  frameMaterial: THREE.MeshStandardMaterial,
) => {
  const { width, height, depth, kind } = options;
  const floorCount = Math.max(3, Math.round(height / 1.5));
  const floorHeight = height / floorCount;
  const windowHeight = floorHeight * (kind === 'library' ? 0.58 : 0.5);
  const placements: WindowPlacement[] = [];
  const sides: FacadeSide[] = ['front', 'back', 'left', 'right'];

  sides.forEach((side, sideIndex) => {
    const frontBack = side === 'front' || side === 'back';
    const span = frontBack ? width : depth;
    const columns = Math.max(3, Math.round(span / 0.95));
    const cellWidth = (span - 0.55) / columns;
    const windowWidth = Math.min(0.72, cellWidth * 0.72);
    const surface = (frontBack ? depth : width) / 2 - 0.045;
    const rotation = [0, Math.PI, -Math.PI / 2, Math.PI / 2][sideIndex];

    for (let floor = 0; floor < floorCount; floor += 1) {
      for (let column = 0; column < columns; column += 1) {
        const along = -span / 2 + 0.275 + cellWidth * (column + 0.5);
        if (side === 'front' && kind === 'library' && Math.abs(along) < 0.75) continue;
        if (side === 'front' && floor === 0 && Math.abs(along) < 0.55) continue;

        // At least one warm window per facade; the rest follow a stable sparse pattern.
        const lit = (floor === sideIndex % floorCount && column === sideIndex % columns)
          || (floor * 7 + column * 3 + sideIndex * 2) % 17 === 0;
        placements.push({
          x: frontBack ? along : side === 'left' ? -surface : surface,
          y: floor * floorHeight + floorHeight * 0.57,
          z: frontBack ? side === 'front' ? surface : -surface : along,
          rotation,
          width: windowWidth,
          height: windowHeight,
          lit,
        });
      }
    }
  });

  const dummy = new THREE.Object3D();
  const setPlacement = (placement: WindowPlacement, outward = 0) => {
    dummy.position.set(
      placement.x + Math.sin(placement.rotation) * outward,
      placement.y,
      placement.z + Math.cos(placement.rotation) * outward,
    );
    dummy.rotation.y = placement.rotation;
  };

  const paneGeometry = new THREE.BoxGeometry(1, 1, 0.045);
  ([
    ['window-panes-dark', darkGlass, placements.filter((placement) => !placement.lit)],
    ['window-panes-lit', litGlass, placements.filter((placement) => placement.lit)],
  ] as const).forEach(([name, surface, selected]) => {
    const panes = new THREE.InstancedMesh(paneGeometry, surface, selected.length);
    panes.name = name;
    selected.forEach((placement, index) => {
      setPlacement(placement);
      dummy.scale.set(placement.width, placement.height, 1);
      dummy.updateMatrix();
      panes.setMatrixAt(index, dummy.matrix);
    });
    panes.instanceMatrix.needsUpdate = true;
    group.add(panes);
  });

  const frames = new THREE.InstancedMesh(windowFrameGeometry(), frameMaterial, placements.length);
  frames.name = 'window-frames';
  const mullions = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.045, 1, 0.035),
    frameMaterial,
    placements.length,
  );
  mullions.name = 'window-mullions';
  placements.forEach((placement, index) => {
    setPlacement(placement, 0.012);
    dummy.scale.set(placement.width + 0.12, placement.height + 0.12, 1);
    dummy.updateMatrix();
    frames.setMatrixAt(index, dummy.matrix);

    setPlacement(placement, 0.042);
    dummy.scale.set(1, placement.height, 1);
    dummy.updateMatrix();
    mullions.setMatrixAt(index, dummy.matrix);
  });
  frames.instanceMatrix.needsUpdate = true;
  mullions.instanceMatrix.needsUpdate = true;
  group.add(frames, mullions);
};

const addAtrium = (group: THREE.Group, options: CampusBuildingOptions, trim: THREE.Material) => {
  const atrium = new THREE.Group();
  atrium.name = 'atrium';
  const glass = material('#367c9a', '#3a9bb2', 0.18, 0.36);
  const atriumHeight = options.height - 0.65;
  const front = options.depth / 2 - 0.01;
  atrium.add(block('atrium-glass', [1.26, atriumHeight, 0.055], [0, atriumHeight / 2 + 0.22, front], glass));
  [-0.67, -0.25, 0.25, 0.67].forEach((x) => {
    atrium.add(block('atrium-mullion', [0.075, atriumHeight, 0.075], [x, atriumHeight / 2 + 0.22, front + 0.01], trim));
  });
  atrium.add(block('atrium-header', [1.43, 0.17, 0.13], [0, options.height - 0.28, front], trim));
  group.add(atrium);
};

const addRoofEquipment = (group: THREE.Group, options: CampusBuildingOptions) => {
  const equipment = new THREE.Group();
  equipment.name = 'roof-equipment';
  const casing = material('#718d99', '#1f4b58', 0.08, 0.62);
  const vent = material('#24465a', '#2d8496', 0.12, 0.68);
  const roofY = options.height + 0.18;
  [-0.72, 0.42].forEach((x, index) => {
    equipment.add(block('air-handler', [0.82, 0.42, 0.7], [x, roofY + 0.21, -0.62], casing));
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.42, 12), vent);
    exhaust.name = 'exhaust-vent';
    exhaust.position.set(x, roofY + 0.62, -0.62 + index * 0.08);
    equipment.add(exhaust);
  });
  group.add(equipment);
};

export const createCampusBuilding = (options: CampusBuildingOptions): THREE.Group => {
  const { width, height, depth, kind } = options;
  const group = new THREE.Group();
  group.position.set(...options.position);
  group.userData = { id: options.id, label: options.label, interactive: true };

  const structure = material('#1c3345', '#193b51', 0.1);
  const trim = material(kind === 'teaching' ? '#80a8b8' : '#718fa2', '#315c6d', 0.12, 0.55);
  const darkTrim = material('#2b5269', '#28566d', 0.12, 0.56);
  const glass = material('#b0d5e0', '#4e8ea5', 0.12, 0.38);
  const windowDark = material('#78aabd', '#306a82', 0.08, 0.35);
  const windowLit = material('#f2dba8', '#f5b669', 0.42, 0.12);
  const windowTrim = material('#8daeba', '#447487', 0.14, 0.53);
  const facade = material('#19495f', '#27617a', 0.14, 0.32);

  group.add(block('opaque-core', [width - 0.12, height, depth - 0.12], [0, height / 2, 0], structure));
  group.add(block('ground-plinth', [width, 0.24, depth], [0, 0.12, 0], darkTrim));

  const floorCount = Math.max(3, Math.round(height / 1.5));
  const floorHeight = height / floorCount;
  for (let floor = 1; floor < floorCount; floor += 1) {
    group.add(block(`floor-band-${floor}`, [width, kind === 'teaching' ? 0.15 : 0.11, depth], [0, floor * floorHeight, 0], trim));
  }
  group.add(block(`floor-band-${floorCount}`, [width, 0.17, depth], [0, height - 0.15, 0], trim));

  const facadeHeight = height - 0.54;
  group.add(block('facade-glass-front', [width - 0.33, facadeHeight, 0.045], [0, facadeHeight / 2 + 0.26, depth / 2 - 0.075], facade));
  group.add(block('facade-glass-back', [width - 0.33, facadeHeight, 0.045], [0, facadeHeight / 2 + 0.26, -depth / 2 + 0.075], facade));
  group.add(block('facade-glass-left', [0.045, facadeHeight, depth - 0.33], [-width / 2 + 0.075, facadeHeight / 2 + 0.26, 0], facade));
  group.add(block('facade-glass-right', [0.045, facadeHeight, depth - 0.33], [width / 2 - 0.075, facadeHeight / 2 + 0.26, 0], facade));
  addWindows(group, options, windowDark, windowLit, windowTrim);

  // Solid corner piers frame the glass and remain visible at overview scale.
  for (const x of [-width / 2 + 0.12, width / 2 - 0.12]) {
    for (const z of [-depth / 2 + 0.12, depth / 2 - 0.12]) {
      group.add(block('corner-pier', [0.22, height, 0.22], [x, height / 2, z], darkTrim));
    }
  }

  const front = depth / 2 - 0.022;
  group.add(block('entrance-glass', [0.92, 1.25, 0.045], [0, 0.76, front], glass));
  group.add(block('entrance-canopy', [1.72, 0.13, 0.62], [0, 1.55, depth / 2 - 0.34], trim));
  group.add(block('entrance-lintel', [1.15, 0.11, 0.08], [0, 1.38, front], darkTrim));

  const roof = material('#2d4e61', '#214559', 0.09, 0.46);
  group.add(block('roof-slab', [width, 0.16, depth], [0, height + 0.08, 0], roof));
  group.add(block('parapet-front', [width, 0.18, 0.09], [0, height + 0.11, depth / 2 - 0.045], darkTrim));
  group.add(block('parapet-back', [width, 0.18, 0.09], [0, height + 0.11, -depth / 2 + 0.045], darkTrim));
  group.add(block('parapet-left', [0.09, 0.18, depth], [-width / 2 + 0.045, height + 0.11, 0], darkTrim));
  group.add(block('parapet-right', [0.09, 0.18, depth], [width / 2 - 0.045, height + 0.11, 0], darkTrim));

  if (kind === 'library') addAtrium(group, options, trim);
  if (kind === 'laboratory') addRoofEquipment(group, options);

  return group;
};
