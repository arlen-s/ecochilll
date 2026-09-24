import * as THREE from 'three';

export interface ThermalTankVisuals {
  group: THREE.Group;
  storedLayer: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  returnLayer: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  interfaceSurface: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  interfaceRim: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  pulseRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  shellMaterial: THREE.MeshStandardMaterial;
  capMaterial: THREE.MeshStandardMaterial;
  rimMaterial: THREE.MeshStandardMaterial;
  pipeMaterial: THREE.MeshStandardMaterial;
  internalBottom: number;
  internalHeight: number;
}

const makeLabelMaterial = (color: string) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.4,
    roughness: 0.22,
    metalness: 0.78,
    transparent: true,
    opacity: 0.96,
  });

export const createThermalTank = (): ThermalTankVisuals => {
  const group = new THREE.Group();
  group.position.set(-10.2, 0, 6.2);
  group.userData = { id: 'storage', label: '分层蓄能水罐', interactive: true };

  const internalBottom = 0.38;
  const internalHeight = 3.72;
  const storedLayerMaterial = new THREE.MeshStandardMaterial({
    color: '#29d7ff',
    emissive: '#29d7ff',
    emissiveIntensity: 0.52,
    roughness: 0.18,
    metalness: 0.05,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  const returnLayerMaterial = new THREE.MeshStandardMaterial({
    color: '#315b9e',
    emissive: '#315b9e',
    emissiveIntensity: 0.28,
    roughness: 0.28,
    metalness: 0.04,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const storedLayer = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 1, 40), storedLayerMaterial);
  const returnLayer = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 1, 40), returnLayerMaterial);
  storedLayer.renderOrder = 1;
  returnLayer.renderOrder = 1;
  group.add(storedLayer, returnLayer);

  const interfaceSurface = new THREE.Mesh(
    new THREE.CircleGeometry(1.11, 48),
    new THREE.MeshBasicMaterial({
      color: '#29d7ff',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  interfaceSurface.rotation.x = -Math.PI / 2;
  interfaceSurface.renderOrder = 2;

  const interfaceRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.14, 0.035, 8, 48),
    new THREE.MeshBasicMaterial({
      color: '#29d7ff',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  interfaceRim.rotation.x = Math.PI / 2;
  interfaceRim.renderOrder = 3;

  const pulseRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.7, 0.045, 8, 48),
    new THREE.MeshBasicMaterial({
      color: '#28e0ff',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  pulseRing.rotation.x = Math.PI / 2;
  pulseRing.renderOrder = 3;
  group.add(interfaceSurface, interfaceRim, pulseRing);

  const shellMaterial = new THREE.MeshStandardMaterial({
      color: '#85b5cc',
      emissive: '#3de1ff',
      emissiveIntensity: 0.24,
      roughness: 0.3,
      metalness: 0.72,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(1.46, 1.46, 4.35, 40, 1, true),
    shellMaterial,
  );
  shell.name = 'tank-shell';
  shell.position.y = 2.25;
  shell.renderOrder = 2;
  group.add(shell);

  const capMaterial = new THREE.MeshStandardMaterial({
    color: '#163d58',
    emissive: '#3de1ff',
    emissiveIntensity: 0.3,
    roughness: 0.26,
    metalness: 0.8,
  });
  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.46, 0.18, 40), capMaterial);
  topCap.position.y = 4.48;
  const bottomCap = new THREE.Mesh(new THREE.CylinderGeometry(1.46, 1.5, 0.2, 40), capMaterial);
  bottomCap.position.y = 0.1;
  group.add(topCap, bottomCap);

  const serviceMetal = new THREE.MeshStandardMaterial({
    color: '#8aa6b0', metalness: 0.7, roughness: 0.42,
    emissive: '#17475b', emissiveIntensity: 0.09,
  });
  for (const [x, z] of [[-0.98, -0.98], [-0.98, 0.98], [0.98, -0.98], [0.98, 0.98]]) {
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.56, 0.22), serviceMetal);
    support.name = 'tank-support';
    support.position.set(x, 0.29, z);
    group.add(support);
  }
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.09, 24), serviceMetal);
  hatch.name = 'service-hatch';
  hatch.position.set(-0.42, 4.62, -0.18);
  group.add(hatch);

  const ladder = new THREE.Group();
  ladder.name = 'inspection-ladder';
  ladder.position.x = -1.57;
  for (const z of [-0.27, 0.27]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 3.45, 0.055), serviceMetal);
    rail.position.set(0, 2.08, z);
    ladder.add(rail);
  }
  for (let rung = 0; rung < 9; rung += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.055, 0.56), serviceMetal);
    step.position.set(0.015, 0.53 + rung * 0.38, 0);
    ladder.add(step);
  }
  group.add(ladder);

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: '#9cc8da',
    emissive: '#3de1ff',
    emissiveIntensity: 0.38,
    roughness: 0.2,
    metalness: 0.9,
  });
  [0.28, 2.25, 4.3].forEach((height) => {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.49, 0.075, 10, 48), rimMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = height;
    group.add(rim);
  });

  const insulationBand = new THREE.Mesh(
    new THREE.CylinderGeometry(1.51, 1.51, 0.34, 40, 1, true),
    new THREE.MeshStandardMaterial({
      color: '#d3eff7',
      emissive: '#4bc7df',
      emissiveIntensity: 0.18,
      roughness: 0.62,
      metalness: 0.35,
      transparent: true,
      opacity: 0.68,
    }),
  );
  insulationBand.position.y = 3.55;
  group.add(insulationBand);

  const pipeMaterial = new THREE.MeshStandardMaterial({
    color: '#24556d',
    emissive: '#3de1ff',
    emissiveIntensity: 0.42,
    roughness: 0.24,
    metalness: 0.78,
  });
  const upperPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.15, 18), pipeMaterial);
  upperPipe.name = 'upper-pipe';
  upperPipe.rotation.z = Math.PI / 2;
  upperPipe.position.set(1.85, 3.45, 0);
  const lowerPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.15, 18), pipeMaterial);
  lowerPipe.name = 'lower-pipe';
  lowerPipe.rotation.z = Math.PI / 2;
  lowerPipe.position.set(1.85, 1.05, 0);
  group.add(upperPipe, lowerPipe);
  for (const y of [1.05, 3.45]) {
    const valve = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 8, 16), serviceMetal);
    valve.name = 'pipe-valve';
    valve.position.set(2.36, y + 0.21, 0.1);
    group.add(valve);
  }

  const skid = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 1.15), capMaterial);
  skid.position.set(2.25, 0.18, 0.72);
  const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.72, 24), pipeMaterial);
  pump.rotation.z = Math.PI / 2;
  pump.position.set(2.25, 0.65, 0.72);
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.72), makeLabelMaterial('#46b3ff'));
  motor.position.set(2.92, 0.65, 0.72);
  group.add(skid, pump, motor);

  const hitTarget = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 4.9, 3.2),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  hitTarget.position.set(0.8, 2.35, 0.3);
  group.add(hitTarget);

  return {
    group,
    storedLayer,
    returnLayer,
    interfaceSurface,
    interfaceRim,
    pulseRing,
    shellMaterial,
    capMaterial,
    rimMaterial,
    pipeMaterial,
    internalBottom,
    internalHeight,
  };
};
