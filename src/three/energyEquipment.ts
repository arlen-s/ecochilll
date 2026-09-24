import * as THREE from 'three';

const finish = (color: string, metalness = 0.45, emissive = '#071824', emissiveIntensity = 0.06) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.48, emissive, emissiveIntensity });

const box = (name: string, size: [number, number, number], at: [number, number, number], surface: THREE.Material) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), surface);
  mesh.name = name;
  mesh.position.set(...at);
  return mesh;
};

const roofLayouts = [
  { centerX: -6.2, firstZ: -1.62, roofY: 6.16 },
  { centerX: 0.2, firstZ: 0.25, roofY: 7.56 },
];

export const createPvArray = (): THREE.Group => {
  const group = new THREE.Group();
  group.userData = { id: 'pv', label: '屋顶光伏阵列', interactive: true };

  const darkGlass = finish('#193e61', 0.32, '#0b4960', 0.12);
  const cellGlass = finish('#28688b', 0.38, '#115b70', 0.1);
  const aluminum = finish('#9fb9bd', 0.73);
  const supportMetal = finish('#596f7a', 0.7);
  const surface = new THREE.InstancedMesh(new THREE.BoxGeometry(0.58, 0.045, 0.72), darkGlass, 24);
  surface.name = 'pv-panel-surface';
  const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.012, 0.315), cellGlass, 96);
  cells.name = 'pv-cells';
  const sideRails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.024, 0.05, 0.74), aluminum, 48);
  sideRails.name = 'pv-side-rails';
  const endRails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.05, 0.024), aluminum, 48);
  endRails.name = 'pv-end-rails';
  const supports = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, 0.28, 0.045), supportMetal, 48);
  supports.name = 'pv-supports';
  const dummy = new THREE.Object3D();
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.24, 0, 0));
  const local = new THREE.Vector3();
  let panelIndex = 0;
  let cellIndex = 0;
  let edgeIndex = 0;

  const setMatrix = (mesh: THREE.InstancedMesh, index: number, position: THREE.Vector3, rotation: THREE.Quaternion) => {
    dummy.position.copy(position);
    dummy.quaternion.copy(rotation);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  };

  roofLayouts.forEach(({ centerX, firstZ, roofY }) => {
    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 6; column += 1) {
        const center = new THREE.Vector3(centerX + (column - 2.5) * 0.76, roofY + 0.28, firstZ + row * 1.62);
        setMatrix(surface, panelIndex, center, tilt);
        for (const x of [-0.135, 0.135]) {
          for (const z of [-0.17, 0.17]) {
            local.set(x, 0.034, z).applyQuaternion(tilt).add(center);
            setMatrix(cells, cellIndex++, local, tilt);
          }
        }
        for (const side of [-1, 1]) {
          local.set(side * 0.29, 0.009, 0).applyQuaternion(tilt).add(center);
          setMatrix(sideRails, edgeIndex, local, tilt);
          local.set(0, 0.009, side * 0.36).applyQuaternion(tilt).add(center);
          setMatrix(endRails, edgeIndex, local, tilt);
          setMatrix(supports, edgeIndex++, new THREE.Vector3(center.x + side * 0.2, roofY + 0.14, center.z), new THREE.Quaternion());
        }
        panelIndex += 1;
      }
    }
  });

  [surface, cells, sideRails, endRails, supports].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  });
  const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  group.add(box('pv-hit-target', [4.4, 0.38, 3.7], [-6.2, 6.52, -0.8], hitMaterial));
  group.add(box('pv-hit-target', [4.6, 0.38, 3.9], [0.2, 7.92, 1.1], hitMaterial));
  return group;
};

export const createAcStation = (): THREE.Group => {
  const group = new THREE.Group();
  group.position.set(5.4, 0, 5.8);
  group.userData = { id: 'ac', label: '冷热源机房', interactive: true };
  const wall = finish('#778d9a', 0.48);
  const trim = finish('#314d60', 0.7);
  const dark = finish('#1b3447', 0.38);
  const steel = finish('#a6c5ce', 0.8);
  const supply = finish('#4fa3c7', 0.65, '#116382', 0.16);
  const returnPipe = finish('#8a9ca4', 0.65);
  group.add(box('ac-concrete-pad', [4.1, 0.2, 3.1], [0, 0.1, 0], trim));
  group.add(box('ac-housing', [3.65, 1.28, 2.62], [0, 0.84, 0], wall));
  group.add(box('ac-top', [3.75, 0.16, 2.72], [0, 1.56, 0], trim));
  group.add(box('ac-control-cabinet', [0.72, 1.54, 0.75], [1.26, 1.11, -0.3], dark));
  group.add(box('ac-control-display', [0.33, 0.22, 0.018], [1.26, 1.55, 0.086], supply));

  const fanInterior = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.07, 24), dark);
  for (let index = 0; index < 3; index += 1) {
    const x = -1.08 + index * 1.08;
    const fan = fanInterior.clone();
    fan.name = 'fan-housing';
    fan.rotation.x = Math.PI / 2;
    fan.position.set(x, 0.91, 1.34);
    group.add(fan);
    const grille = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.035, 8, 24), steel);
    grille.name = 'fan-grille';
    grille.position.set(x, 0.91, 1.405);
    group.add(grille);
    for (let blade = 0; blade < 3; blade += 1) {
      const vane = box('fan-blade', [0.07, 0.27, 0.018], [x, 1.06, 1.414], trim);
      vane.rotation.z = blade * Math.PI * 2 / 3;
      vane.position.x = x + Math.sin(vane.rotation.z) * 0.12;
      vane.position.y = 0.91 + Math.cos(vane.rotation.z) * 0.12;
      group.add(vane);
    }
  }
  const louverGroup = new THREE.Group();
  louverGroup.name = 'ac-louvers';
  for (let index = 0; index < 7; index += 1) {
    const slat = box('louver-slat', [0.72, 0.035, 0.04], [-1.18, 0.38 + index * 0.14, -1.34], dark);
    slat.rotation.x = -0.18;
    louverGroup.add(slat);
  }
  group.add(louverGroup);
  const supplyPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.03, 16), supply);
  supplyPipe.name = 'ac-supply-pipe';
  supplyPipe.rotation.z = Math.PI / 2;
  supplyPipe.position.set(2.24, 0.7, 0.63);
  const returnWaterPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.03, 16), returnPipe);
  returnWaterPipe.name = 'ac-return-pipe';
  returnWaterPipe.rotation.z = Math.PI / 2;
  returnWaterPipe.position.set(2.24, 0.42, -0.63);
  group.add(supplyPipe, returnWaterPipe);
  return group;
};

export const createGridGateway = (): THREE.Group => {
  const group = new THREE.Group();
  group.position.set(12.8, 0, 4.8);
  group.userData = { id: 'grid', label: '园区电网接口', interactive: true };
  const concrete = finish('#596a70', 0.16);
  const cabinetMetal = finish('#7a8e94', 0.62);
  const steel = finish('#a2b5b2', 0.76);
  const dark = finish('#2a3f4a', 0.62);
  const warning = finish('#c9a75a', 0.47, '#8b601f', 0.08);
  group.add(box('grid-plinth', [2.9, 0.18, 1.85], [0, 0.09, 0], concrete));
  group.add(box('transformer-cabinet', [1.35, 1.65, 0.82], [-0.5, 1.02, 0.35], cabinetMetal));
  group.add(box('cabinet-door', [1.12, 1.38, 0.055], [-0.5, 1.02, 0.79], dark));
  group.add(box('cabinet-warning-mark', [0.22, 0.22, 0.02], [-0.5, 1.38, 0.84], warning));
  for (const x of [-0.94, -0.06]) {
    group.add(box('grid-column', [0.15, 4.48, 0.15], [x, 2.34, -0.38], steel));
  }
  group.add(box('grid-crossarm', [2.56, 0.14, 0.2], [-0.5, 4.6, -0.38], steel));
  for (const x of [-1.32, -0.5, 0.32]) {
    const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.37, 12), warning);
    insulator.name = 'grid-insulator';
    insulator.position.set(x, 4.86, -0.38);
    group.add(insulator);
  }
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.32, 4.98, -0.38),
      new THREE.Vector3(0.66, 4.62, -0.3),
      new THREE.Vector3(0.6, 3.25, 0.05),
      new THREE.Vector3(0.3, 2.05, 0.35),
    ]), 20, 0.035, 5, false),
    dark,
  );
  cable.name = 'grid-cable';
  group.add(cable);
  return group;
};
