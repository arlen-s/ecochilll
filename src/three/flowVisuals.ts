import * as THREE from 'three';

export interface FlowParticle {
  mesh: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  offset: number;
}

export interface FlowPath {
  id: string;
  kind: 'electric' | 'thermal';
  curve: THREE.CatmullRomCurve3;
  particles: FlowParticle[];
  pipe: THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial>;
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  glow: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  color: THREE.Color;
  visibleFactor: number;
  speed: number;
  phase: number;
}

export const createFlowVisual = (
  id: string,
  points: THREE.Vector3[],
  color: string,
  speed: number,
  kind: FlowPath['kind'],
): FlowPath => {
  const curve = new THREE.CatmullRomCurve3(points);
  const pipe = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 72, kind === 'thermal' ? 0.075 : 0.045, 6, false),
    new THREE.MeshStandardMaterial({
      color: kind === 'thermal' ? '#31566c' : '#415865',
      metalness: 0.62,
      roughness: 0.4,
      emissive: kind === 'thermal' ? '#17465b' : '#304f55',
      emissiveIntensity: 0.14,
    }),
  );
  pipe.name = `${id}-conduit`;
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curve.getPoints(72)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.42, depthWrite: false }),
  );
  const glow = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 72, 0.055, 5, false),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.1, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const particleGeometry = new THREE.ConeGeometry(0.09, 0.24, 6);
  const particleMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
  const particles = Array.from({ length: 7 }, (_, index) => ({
    mesh: new THREE.Mesh(particleGeometry, particleMaterial),
    offset: index / 7,
  }));
  return {
    id, kind, curve, particles, pipe, line, glow,
    color: new THREE.Color(color), visibleFactor: 1, speed, phase: 0,
  };
};

export const createEnergyFlowPaths = (): FlowPath[] => [
  createFlowVisual(
    'pv-plant',
    [new THREE.Vector3(1.5, 7.85, 1.8), new THREE.Vector3(3.2, 5.1, 4), new THREE.Vector3(4.2, 2.2, 5.7)],
    '#15f5ba', 0.16, 'electric',
  ),
  createFlowVisual(
    'grid-plant',
    [new THREE.Vector3(12.5, 4.6, 4.8), new THREE.Vector3(11, 3.2, 5.5), new THREE.Vector3(6.8, 1.8, 5.8)],
    '#ff9d7f', 0.12, 'electric',
  ),
  createFlowVisual(
    'plant-storage',
    [new THREE.Vector3(4.4, 1.6, 5.8), new THREE.Vector3(-2.4, 2.8, 6.6), new THREE.Vector3(-8.35, 3.45, 6.2)],
    '#28e0ff', 0.18, 'thermal',
  ),
  createFlowVisual(
    'storage-buildings',
    [new THREE.Vector3(-8.35, 1.05, 6.2), new THREE.Vector3(-5.4, 1.4, 3.9), new THREE.Vector3(-1.4, 1.5, 1.7)],
    '#4d8dff', 0.2, 'thermal',
  ),
];
