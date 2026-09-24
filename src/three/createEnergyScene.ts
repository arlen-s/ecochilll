import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { FocusView, OperatingMode, ScenarioMode, ThermalStorageMetrics } from '@/types/energy';
import { deriveThermalVisualState } from './thermalVisualState';
import { createCampusBuilding } from './campusBuildings';
import { createAcStation, createGridGateway, createPvArray } from './energyEquipment';

interface HoverPayload {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface SceneOptions {
  onHover?: (payload: HoverPayload | null) => void;
  onSelect?: (id: string) => void;
}

interface FlowParticle {
  mesh: THREE.Mesh;
  offset: number;
}

interface FlowPath {
  id: string;
  curve: THREE.CatmullRomCurve3;
  particles: FlowParticle[];
  line: THREE.Line;
  glow: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  color: THREE.Color;
  visibleFactor: number;
  speed: number;
  phase: number;
}

interface ThermalTankVisuals {
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

const viewPresets: Record<FocusView, { position: THREE.Vector3; target: THREE.Vector3 }> = {
  overview: {
    position: new THREE.Vector3(18, 12, 22),
    target: new THREE.Vector3(0, 3, 0),
  },
  pv: {
    position: new THREE.Vector3(-4, 8, 12),
    target: new THREE.Vector3(-3.8, 4.6, -0.8),
  },
  ac: {
    position: new THREE.Vector3(8, 6.8, 14),
    target: new THREE.Vector3(5.2, 1.5, 5.8),
  },
  storage: {
    position: new THREE.Vector3(-13, 6, 14),
    target: new THREE.Vector3(-10, 1.8, 6.4),
  },
};

const getResponsivePreset = (preset: { position: THREE.Vector3; target: THREE.Vector3 }, aspect: number) => {
  if (aspect >= 1.45) {
    return {
      position: preset.position.clone(),
      target: preset.target.clone(),
    };
  }

  const aspectFactor = THREE.MathUtils.clamp((1.45 - aspect) / 0.55, 0, 1);
  const offset = preset.position.clone().sub(preset.target);
  offset.multiplyScalar(1 + aspectFactor * 0.18);
  offset.y += 0.6 + aspectFactor * 0.9;

  return {
    position: preset.target.clone().add(offset),
    target: preset.target.clone(),
  };
};

const applyZoomScaleToPreset = (
  preset: { position: THREE.Vector3; target: THREE.Vector3 },
  zoomScale: number,
) => {
  const offset = preset.position.clone().sub(preset.target).multiplyScalar(zoomScale);

  return {
    position: preset.target.clone().add(offset),
    target: preset.target.clone(),
  };
};

const tempVector = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const flowForward = new THREE.Vector3(0, 1, 0);

export const advanceFlowPhase = (
  phase: number,
  deltaSeconds: number,
  speed: number,
  visibleFactor: number,
) => {
  const safePhase = Number.isFinite(phase) ? phase : 0;
  const safeDelta = Math.max(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0);
  const safeSpeed = Math.max(Number.isFinite(speed) ? speed : 0, 0);
  const activity = Math.min(Math.max(Number.isFinite(visibleFactor) ? visibleFactor : 0, 0), 1);

  return (safePhase + safeDelta * safeSpeed * (0.9 + activity)) % 1;
};

const cacheGroupBaseIntensity = (group: THREE.Object3D) => {
  group.traverse((child) => {
    const material = (child as THREE.Mesh).material;
    if (!material) return;

    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((entry) => {
      if ('emissiveIntensity' in entry) {
        entry.userData.baseEmissiveIntensity ??= entry.emissiveIntensity ?? 0.4;
      }
    });
  });
};

const setGroupIntensityBoost = (group: THREE.Object3D, boost: number) => {
  group.traverse((child) => {
    const material = (child as THREE.Mesh).material;
    if (!material) return;

    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((entry) => {
      if ('emissiveIntensity' in entry) {
        const base = Number(entry.userData.baseEmissiveIntensity ?? entry.emissiveIntensity ?? 0.4);
        entry.emissiveIntensity = base + boost;
      }
    });
  });
};

const findInteractiveTarget = (object: THREE.Object3D | null) => {
  let current = object;
  while (current && !current.userData.interactive) {
    current = current.parent;
  }
  return current;
};

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

const createRoundedPlatform = () => {
  const platform = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(17, 19.2, 1.8, 8),
    new THREE.MeshStandardMaterial({
      color: '#08192d',
      emissive: '#08233b',
      emissiveIntensity: 0.35,
      roughness: 0.8,
      metalness: 0.4,
    }),
  );
  base.position.y = -0.9;
  platform.add(base);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(16.4, 0.09, 8, 64),
    new THREE.MeshBasicMaterial({ color: '#3de1ff', transparent: true, opacity: 0.55 }),
  );
  ring.rotation.x = Math.PI / 2;
  platform.add(ring);

  const innerGrid = new THREE.GridHelper(28, 14, '#46b3ff', '#1a3950');
  innerGrid.position.y = 0.02;
  (innerGrid.material as THREE.Material).transparent = true;
  (innerGrid.material as THREE.Material).opacity = 0.24;
  platform.add(innerGrid);

  return platform;
};

const createThermalTank = (): ThermalTankVisuals => {
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
  upperPipe.rotation.z = Math.PI / 2;
  upperPipe.position.set(1.85, 3.45, 0);
  const lowerPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.15, 18), pipeMaterial);
  lowerPipe.rotation.z = Math.PI / 2;
  lowerPipe.position.set(1.85, 1.05, 0);
  group.add(upperPipe, lowerPipe);

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

const createSunAndClouds = () => {
  const group = new THREE.Group();

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 24, 24),
    new THREE.MeshBasicMaterial({ color: '#fff4b8' }),
  );
  sun.position.set(12, 15, -10);
  group.add(sun);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 24, 24),
    new THREE.MeshBasicMaterial({ color: '#ffd66b', transparent: true, opacity: 0.22 }),
  );
  halo.position.copy(sun.position);
  group.add(halo);

  const clouds = new THREE.Group();
  const cloudMaterial = new THREE.MeshBasicMaterial({
    color: '#d7efff',
    transparent: true,
    opacity: 0.16,
  });

  const seeds = [
    [-8, 10, -6],
    [-5.2, 10.5, -4.8],
    [2, 9.8, -9],
    [4.2, 10.2, -7.5],
  ];

  seeds.forEach(([x, y, z], index) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1.2 + index * 0.12, 20, 20), cloudMaterial);
    puff.position.set(x, y, z);
    clouds.add(puff);
  });

  group.add(clouds);
  return { group, sun, halo, clouds };
};

const createParticles = () => {
  const geometry = new THREE.BufferGeometry();
  const count = 120;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 32;
    positions[i * 3 + 1] = Math.random() * 10 + 1;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 22;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: '#5defff',
      size: 0.08,
      transparent: true,
      opacity: 0.55,
    }),
  );
};

const createFlowPath = (id: string, points: THREE.Vector3[], color: string, speed: number) => {
  const curve = new THREE.CatmullRomCurve3(points);
  const sampled = curve.getPoints(72);
  const geometry = new THREE.BufferGeometry().setFromPoints(sampled);
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.48,
    }),
  );

  const glow = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 72, 0.13, 5, false),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  const particleGeometry = new THREE.ConeGeometry(0.15, 0.42, 8);
  const particleMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
  const particles = Array.from({ length: 8 }, (_, index) => ({
    mesh: new THREE.Mesh(particleGeometry, particleMaterial),
    offset: index / 8,
  }));

  return {
    id,
    curve,
    particles,
    line,
    glow,
    color: new THREE.Color(color),
    visibleFactor: 1,
    speed,
    phase: 0,
  } satisfies FlowPath;
};

export const createEnergyScene = (container: HTMLElement, options: SceneOptions = {}) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#041120');
  scene.fog = new THREE.Fog('#041120', 18, 42);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 120);
  camera.position.copy(viewPresets.overview.position);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI / 2.08;
  controls.minDistance = 8;
  controls.maxDistance = 36;
  controls.target.copy(viewPresets.overview.target);

  const ambient = new THREE.AmbientLight('#8bbfff', 1.4);
  const sunLight = new THREE.DirectionalLight('#fff0c4', 1.85);
  sunLight.position.set(12, 20, -8);
  scene.add(ambient, sunLight);

  const platform = createRoundedPlatform();
  scene.add(platform);

  const buildingA = createCampusBuilding({ id: 'building-a', label: '教学楼 A', kind: 'teaching', width: 4.6, height: 6, depth: 4.2, position: [-6.2, 0, -0.8] });
  const buildingB = createCampusBuilding({ id: 'building-b', label: '图书馆', kind: 'library', width: 4.8, height: 7.4, depth: 4.6, position: [0.2, 0, 1.1] });
  const buildingC = createCampusBuilding({ id: 'building-c', label: '实验楼', kind: 'laboratory', width: 3.8, height: 4.8, depth: 3.8, position: [6.2, 0, -1.6] });
  const pvArray = createPvArray();
  const acStation = createAcStation();
  const thermalTank = createThermalTank();
  const storage = thermalTank.group;
  const grid = createGridGateway();
  const { group: skyObjects, sun, halo, clouds } = createSunAndClouds();
  const particles = createParticles();

  scene.add(buildingA, buildingB, buildingC, pvArray, acStation, storage, grid, skyObjects, particles);

  const interactiveObjects = [buildingA, buildingB, buildingC, pvArray, acStation, storage, grid];
  const interactiveMap = new Map(interactiveObjects.map((item) => [item.userData.id as string, item]));
  interactiveObjects.forEach((group) => cacheGroupBaseIntensity(group));

  const flowGroup = new THREE.Group();
  scene.add(flowGroup);

  const flows: FlowPath[] = [
    createFlowPath(
      'pv-plant',
      [new THREE.Vector3(-2.2, 6.3, 0.8), new THREE.Vector3(0.4, 5.2, 4), new THREE.Vector3(4.2, 2.2, 5.7)],
      '#15f5ba',
      0.16,
    ),
    createFlowPath(
      'grid-plant',
      [new THREE.Vector3(12.5, 4.6, 4.8), new THREE.Vector3(11, 3.2, 5.5), new THREE.Vector3(6.8, 1.8, 5.8)],
      '#ff9d7f',
      0.12,
    ),
    createFlowPath(
      'plant-storage',
      [new THREE.Vector3(4.4, 1.6, 5.8), new THREE.Vector3(-2.4, 2.8, 6.6), new THREE.Vector3(-8.35, 3.45, 6.2)],
      '#28e0ff',
      0.18,
    ),
    createFlowPath(
      'storage-buildings',
      [new THREE.Vector3(-8.35, 1.05, 6.2), new THREE.Vector3(-5.4, 1.4, 3.9), new THREE.Vector3(-1.4, 1.5, 1.7)],
      '#4d8dff',
      0.2,
    ),
  ];

  flows.forEach((flow) => {
    flowGroup.add(flow.glow, flow.line);
    flow.particles.forEach((particle) => flowGroup.add(particle.mesh));
  });

  let hovered: THREE.Object3D | null = null;
  let selectedId = 'pv';
  let alertedIds = new Set<string>();
  let focus: FocusView = 'overview';
  let zoomScale = 1;
  const buildPresetForFocus = (nextFocus: FocusView) =>
    applyZoomScaleToPreset(
      getResponsivePreset(viewPresets[nextFocus], container.clientWidth / Math.max(container.clientHeight, 1)),
      zoomScale,
    );
  const getCurrentPreset = () => buildPresetForFocus(focus);
  const initialPreset = buildPresetForFocus('overview');
  const desiredPosition = initialPreset.position.clone();
  const desiredTarget = initialPreset.target.clone();
  const clock = new THREE.Clock();
  const flowMap = new Map(flows.map((flow) => [flow.id, flow]));
  let operatingMode: OperatingMode = 'cooling';
  let thermalState: ThermalStorageMetrics | null = null;
  let thermalPulseActivity = 0;

  const setFlowColor = (flow: FlowPath | undefined, color: string) => {
    if (!flow) return;
    flow.color.set(color);
    (flow.line.material as THREE.LineBasicMaterial).color.set(color);
    flow.glow.material.color.set(color);
    flow.particles.forEach((particle) => {
      (particle.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    });
  };

  const setFlowActivity = (flow: FlowPath | undefined, factor: number, speed?: number) => {
    if (!flow) return;
    flow.visibleFactor = THREE.MathUtils.clamp(factor, 0, 1);
    if (speed !== undefined) flow.speed = speed;
    flow.line.visible = flow.visibleFactor > 0;
    flow.glow.visible = flow.visibleFactor > 0;
    (flow.line.material as THREE.LineBasicMaterial).opacity = flow.visibleFactor > 0
      ? 0.12 + flow.visibleFactor * 0.46
      : 0;
    flow.glow.material.opacity = flow.visibleFactor > 0
      ? 0.04 + flow.visibleFactor * 0.16
      : 0;
  };

  const applyThermalVisuals = () => {
    const visual = deriveThermalVisualState(
      operatingMode,
      thermalState,
      thermalTank.internalBottom,
      thermalTank.internalHeight,
    );
    const minimumScale = 0.018;

    thermalTank.storedLayer.visible = visual.storedHeight > 0.001;
    thermalTank.returnLayer.visible = visual.returnHeight > 0.001;
    thermalTank.storedLayer.scale.y = Math.max(visual.storedHeight, minimumScale);
    thermalTank.returnLayer.scale.y = Math.max(visual.returnHeight, minimumScale);
    thermalTank.storedLayer.position.y = visual.storedBottom + visual.storedHeight / 2;
    thermalTank.returnLayer.position.y = visual.returnBottom + visual.returnHeight / 2;
    thermalTank.storedLayer.material.color.set(visual.surfaceColor);
    thermalTank.storedLayer.material.emissive.set(visual.surfaceColor);
    thermalTank.returnLayer.material.color.set(visual.returnedColor);
    thermalTank.returnLayer.material.emissive.set(visual.returnedColor);
    thermalTank.shellMaterial.color.set(operatingMode === 'cooling' ? '#85b5cc' : '#c59479');
    thermalTank.shellMaterial.emissive.set(visual.frameColor);
    thermalTank.capMaterial.color.set(operatingMode === 'cooling' ? '#163d58' : '#603829');
    thermalTank.capMaterial.emissive.set(visual.frameColor);
    thermalTank.rimMaterial.color.set(operatingMode === 'cooling' ? '#9cc8da' : '#ffd0a4');
    thermalTank.rimMaterial.emissive.set(visual.frameColor);
    thermalTank.pipeMaterial.color.set(operatingMode === 'cooling' ? '#24556d' : '#784931');
    thermalTank.pipeMaterial.emissive.set(visual.frameColor);

    thermalTank.interfaceSurface.visible = visual.surfaceVisible;
    thermalTank.interfaceRim.visible = visual.surfaceVisible;
    thermalTank.interfaceSurface.position.y = visual.interfaceY;
    thermalTank.interfaceRim.position.y = visual.interfaceY;
    thermalTank.pulseRing.position.y = visual.interfaceY;
    thermalTank.interfaceSurface.material.color.set(visual.surfaceColor);
    thermalTank.interfaceRim.material.color.set(visual.surfaceColor);
    thermalTank.pulseRing.material.color.set(
      visual.chargeIntensity > 0 ? visual.chargeColor : visual.dischargeColor,
    );
    thermalPulseActivity = Math.max(visual.chargeIntensity, visual.dischargeIntensity);
    thermalTank.pulseRing.visible = visual.surfaceVisible && thermalPulseActivity > 0;
    thermalTank.interfaceSurface.material.opacity = 0.2 + thermalPulseActivity * 0.13;
    thermalTank.interfaceRim.material.opacity = 0.42 + thermalPulseActivity * 0.38;

    setFlowColor(flowMap.get('plant-storage'), visual.chargeColor);
    setFlowColor(flowMap.get('storage-buildings'), visual.dischargeColor);
    setFlowActivity(flowMap.get('plant-storage'), visual.chargeIntensity, 0.1 + visual.chargePowerFactor * 0.2);
    setFlowActivity(flowMap.get('storage-buildings'), visual.dischargeIntensity, 0.1 + visual.dischargePowerFactor * 0.22);
  };

  const applyScenario = (nextScenario: ScenarioMode) => {
    const cloudOpacity = {
      normal: 0.14,
      heatwave: 0.1,
      cloudy: 0.34,
      peakPricing: 0.18,
    }[nextScenario];

    (clouds.children as THREE.Mesh[]).forEach((child) => {
      const material = child.material as THREE.MeshBasicMaterial;
      material.opacity = cloudOpacity;
    });

    const sunIntensity = {
      normal: 1.85,
      heatwave: 2.1,
      cloudy: 1.1,
      peakPricing: 1.65,
    }[nextScenario];
    sunLight.intensity = sunIntensity;
    const haloMaterial = halo.material as THREE.MeshBasicMaterial;
    haloMaterial.color = new THREE.Color(nextScenario === 'cloudy' ? '#d6e6ff' : '#ffd66b');
    haloMaterial.opacity = nextScenario === 'cloudy' ? 0.16 : 0.22;

    const electricalFlowVisibility: Record<ScenarioMode, Record<'pv-plant' | 'grid-plant', number>> = {
      normal: { 'pv-plant': 1, 'grid-plant': 0.24 },
      heatwave: { 'pv-plant': 1, 'grid-plant': 0.38 },
      cloudy: { 'pv-plant': 0.42, 'grid-plant': 0.62 },
      peakPricing: { 'pv-plant': 0.76, 'grid-plant': 0.18 },
    };
    setFlowActivity(flowMap.get('pv-plant'), electricalFlowVisibility[nextScenario]['pv-plant']);
    setFlowActivity(flowMap.get('grid-plant'), electricalFlowVisibility[nextScenario]['grid-plant']);
  };

  const setFocus = (nextFocus: FocusView) => {
    focus = nextFocus;
    const preset = buildPresetForFocus(nextFocus);
    desiredPosition.copy(preset.position);
    desiredTarget.copy(preset.target);
  };

  const syncZoomScaleFromCamera = () => {
    const basePreset = getResponsivePreset(viewPresets[focus], container.clientWidth / Math.max(container.clientHeight, 1));
    const baseDistance = basePreset.position.distanceTo(basePreset.target);
    const currentDistance = camera.position.distanceTo(controls.target);
    zoomScale = THREE.MathUtils.clamp(currentDistance / Math.max(baseDistance, 0.0001), 0.68, 1.85);
  };

  const applyZoom = (nextZoomScale: number) => {
    zoomScale = THREE.MathUtils.clamp(nextZoomScale, 0.68, 1.85);
    const preset = buildPresetForFocus(focus);
    desiredPosition.copy(preset.position);
    desiredTarget.copy(preset.target);
  };

  const handlePointerMove = (event: PointerEvent) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(interactiveObjects, true);
    const nextHovered = findInteractiveTarget(hits[0]?.object ?? null);

    if (nextHovered !== hovered) {
      hovered = nextHovered;
      if (hovered) {
        options.onHover?.({
          id: hovered.userData.id,
          label: hovered.userData.label,
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        });
      } else {
        options.onHover?.(null);
      }
    } else if (hovered) {
      options.onHover?.({
        id: hovered.userData.id,
        label: hovered.userData.label,
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
    }
  };

  const handleClick = () => {
    if (hovered?.userData.id) {
      options.onSelect?.(hovered.userData.id);
    }
  };

  const handlePointerLeave = () => {
    hovered = null;
    options.onHover?.(null);
  };

  renderer.domElement.addEventListener('pointermove', handlePointerMove);
  renderer.domElement.addEventListener('click', handleClick);
  renderer.domElement.addEventListener('pointerleave', handlePointerLeave);

  const animate = () => {
    const delta = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.elapsedTime;
    controls.update();

    if (focus === 'overview') {
      const orbitRadius = 2.4;
      tempVector.set(
        desiredPosition.x + Math.cos(elapsed * 0.22) * orbitRadius,
        desiredPosition.y + Math.sin(elapsed * 0.18) * 0.8,
        desiredPosition.z + Math.sin(elapsed * 0.22) * orbitRadius,
      );
      camera.position.lerp(tempVector, 0.024);
      tempVector.set(desiredTarget.x, desiredTarget.y + Math.sin(elapsed * 0.4) * 0.1, desiredTarget.z);
      controls.target.lerp(tempVector, 0.048);
    } else {
      tempVector.copy(desiredPosition);
      tempVector.y += Math.sin(elapsed * 0.7) * 0.12;
      camera.position.lerp(tempVector, 0.05);
      controls.target.lerp(desiredTarget, 0.08);
    }

    particles.rotation.y += 0.0009;
    sun.position.y = 15 + Math.sin(elapsed * 0.2) * 0.3;
    halo.position.copy(sun.position);
    clouds.position.x = Math.sin(elapsed * 0.08) * 0.6;

    if (thermalTank.pulseRing.visible) {
      const pulse = (Math.sin(elapsed * 3.2) + 1) / 2;
      thermalTank.pulseRing.scale.setScalar(0.94 + pulse * 0.14);
      thermalTank.pulseRing.material.opacity = thermalPulseActivity * (0.14 + pulse * 0.28);
    }

    flows.forEach((flow) => {
      flow.phase = advanceFlowPhase(flow.phase, delta, flow.speed, flow.visibleFactor);
      flow.particles.forEach((particle) => {
        const t = (flow.phase + particle.offset) % 1;
        flow.curve.getPointAt(t, particle.mesh.position);
        flow.curve.getTangentAt(t, tempVector);
        particle.mesh.quaternion.setFromUnitVectors(flowForward, tempVector.normalize());
        particle.mesh.visible = flow.visibleFactor > 0.18;
        particle.mesh.scale.setScalar(0.7 + flow.visibleFactor * 0.7);
        (particle.mesh.material as THREE.MeshBasicMaterial).opacity = 0.4 + flow.visibleFactor * 0.6;
      });
    });

    interactiveObjects.forEach((group, index) => {
      const groupId = group.userData.id as string;
      const isHovered = hovered === group;
      const isSelected = selectedId === groupId;
      const isAlerted = alertedIds.has(groupId);
      const alertPulse = isAlerted ? 0.18 + (Math.sin(elapsed * 3.4 + index) + 1) * 0.28 : 0;
      const boost = (isSelected ? 0.32 : 0) + (isHovered ? 0.52 : 0) + alertPulse;
      setGroupIntensityBoost(group, boost);
    });

    renderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
  };

  let animationId = requestAnimationFrame(animate);
  applyScenario('normal');
  applyThermalVisuals();
  setFocus('overview');

  return {
    resize() {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      const preset = getCurrentPreset();
      desiredPosition.copy(preset.position);
      desiredTarget.copy(preset.target);
    },
    setFocus,
    zoomIn() {
      syncZoomScaleFromCamera();
      applyZoom(zoomScale * 0.88);
    },
    zoomOut() {
      syncZoomScaleFromCamera();
      applyZoom(zoomScale * 1.12);
    },
    resetZoom() {
      applyZoom(1);
    },
    updateScenario(nextScenario: ScenarioMode) {
      applyScenario(nextScenario);
    },
    updateOperatingMode(nextMode: OperatingMode) {
      operatingMode = nextMode;
      applyThermalVisuals();
    },
    updateThermalState(nextStorage: ThermalStorageMetrics) {
      thermalState = nextStorage;
      applyThermalVisuals();
    },
    updateAlerts(nodeIds: string[]) {
      alertedIds = new Set(nodeIds.filter((nodeId) => interactiveMap.has(nodeId)));
    },
    updateSelected(id: string) {
      selectedId = id;
    },
    dispose() {
      cancelAnimationFrame(animationId);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      controls.dispose();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points)) return;
        geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        objectMaterials.forEach((material) => materials.add(material));
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
};
