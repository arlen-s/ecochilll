import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { FocusView, ScenarioMode } from '@/types/energy';

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
  color: THREE.Color;
  visibleFactor: number;
  speed: number;
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

const createBuilding = (
  size: THREE.Vector3,
  position: THREE.Vector3,
  color: string,
  label: string,
  id: string,
) => {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData = { id, label, interactive: true };

  const body = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), makeLabelMaterial(color));
  body.position.y = size.y / 2;
  group.add(body);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 0.96, 0.2, size.z * 0.96),
    new THREE.MeshStandardMaterial({
      color: '#0d2745',
      emissive: '#103c5f',
      emissiveIntensity: 0.35,
      metalness: 0.8,
      roughness: 0.24,
    }),
  );
  roof.position.y = size.y + 0.1;
  group.add(roof);

  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)),
    new THREE.LineBasicMaterial({ color: '#74f7ff', transparent: true, opacity: 0.38 }),
  );
  outline.position.y = size.y / 2;
  group.add(outline);

  return group;
};

const createPvArray = () => {
  const group = new THREE.Group();
  group.userData = { id: 'pv', label: '屋顶光伏阵列', interactive: true };
  const panelGeometry = new THREE.BoxGeometry(0.86, 0.06, 0.56);
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: '#0d2d54',
    emissive: '#15f5ba',
    emissiveIntensity: 0.68,
    metalness: 0.85,
    roughness: 0.2,
  });

  const panelCount = 24;
  const instanced = new THREE.InstancedMesh(panelGeometry, panelMaterial, panelCount);
  const dummy = new THREE.Object3D();

  let index = 0;
  const rows = [0, 1];
  rows.forEach((row, rowIndex) => {
    for (let col = 0; col < 6; col += 1) {
      dummy.position.set(-6.7 + col * 1.1, 6.12, -1.15 + rowIndex * 1.05);
      dummy.rotation.set(-Math.PI / 6, 0, 0.03);
      dummy.updateMatrix();
      instanced.setMatrixAt(index, dummy.matrix);
      index += 1;
    }
  });

  rows.forEach((row, rowIndex) => {
    for (let col = 0; col < 6; col += 1) {
      dummy.position.set(-1.2 + col * 0.98, 7.68, 1.1 + rowIndex * 0.9);
      dummy.rotation.set(-Math.PI / 6, 0.04, 0.02);
      dummy.updateMatrix();
      instanced.setMatrixAt(index, dummy.matrix);
      index += 1;
    }
  });

  instanced.instanceMatrix.needsUpdate = true;
  group.add(instanced);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(10.2, 2.4, 5.6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
  );
  hit.position.set(-4, 6.6, 0.2);
  group.add(hit);

  const glow = new THREE.Mesh(
    new THREE.RingGeometry(2.3, 3.2, 48),
    new THREE.MeshBasicMaterial({ color: '#15f5ba', transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
  );
  glow.position.set(-4, 6.3, 0.3);
  glow.rotation.x = Math.PI / 2;
  group.add(glow);

  return group;
};

const createAcStation = () => {
  const group = new THREE.Group();
  group.position.set(5.4, 0, 5.8);
  group.userData = { id: 'ac', label: '空调冷站', interactive: true };

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 1.1, 2.8),
    makeLabelMaterial('#46b3ff'),
  );
  base.position.y = 0.55;
  group.add(base);

  for (let i = 0; i < 3; i += 1) {
    const fan = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.5, 24),
      new THREE.MeshStandardMaterial({
        color: '#0d2745',
        emissive: '#46b3ff',
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.85,
      }),
    );
    fan.rotation.x = Math.PI / 2;
    fan.position.set(-1 + i * 1, 1.2, 1.18);
    group.add(fan);
  }

  const duct = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.2, 1.2),
    makeLabelMaterial('#89c8ff'),
  );
  duct.position.set(1.25, 1.1, -0.2);
  group.add(duct);

  return group;
};

const createStorage = () => {
  const group = new THREE.Group();
  group.position.set(-10.2, 0, 6.2);
  group.userData = { id: 'storage', label: '储能电池柜', interactive: true };

  for (let i = 0; i < 3; i += 1) {
    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 2.3, 1),
      new THREE.MeshStandardMaterial({
        color: '#10304b',
        emissive: '#ffd66b',
        emissiveIntensity: 0.42,
        roughness: 0.24,
        metalness: 0.84,
      }),
    );
    cabinet.position.set(i * 1.05, 1.15, 0);
    group.add(cabinet);

    const lightStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.7, 0.06),
      new THREE.MeshBasicMaterial({ color: '#15f5ba' }),
    );
    lightStrip.position.set(i * 1.05 - 0.28, 1.15, 0.54);
    group.add(lightStrip);
  }

  return group;
};

const createGridGateway = () => {
  const group = new THREE.Group();
  group.position.set(12.8, 0, 4.8);
  group.userData = { id: 'grid', label: '园区电网接口', interactive: true };

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 5.4, 12),
    makeLabelMaterial('#ffd66b'),
  );
  pole.position.y = 2.7;
  group.add(pole);

  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.16, 0.16),
    makeLabelMaterial('#ffd66b'),
  );
  arm.position.set(0, 4.6, 0);
  group.add(arm);

  const legLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 3.4, 0.12),
    makeLabelMaterial('#ffd66b'),
  );
  legLeft.position.set(-0.9, 1.7, 0);
  legLeft.rotation.z = 0.22;
  group.add(legLeft);

  const legRight = legLeft.clone();
  legRight.position.x = 0.9;
  legRight.rotation.z = -0.22;
  group.add(legRight);

  return group;
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
      opacity: 0.35,
    }),
  );

  const particleGeometry = new THREE.SphereGeometry(0.12, 12, 12);
  const particleMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
  const particles = Array.from({ length: 6 }, (_, index) => ({
    mesh: new THREE.Mesh(particleGeometry, particleMaterial),
    offset: index / 6,
  }));

  return {
    id,
    curve,
    particles,
    line,
    color: new THREE.Color(color),
    visibleFactor: 1,
    speed,
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

  const buildingA = createBuilding(new THREE.Vector3(4.6, 6, 4.2), new THREE.Vector3(-6.2, 0, -0.8), '#114b70', '教学楼 A', 'building-a');
  const buildingB = createBuilding(new THREE.Vector3(4.8, 7.4, 4.6), new THREE.Vector3(0.2, 0, 1.1), '#0d3b5f', '图书馆', 'building-b');
  const buildingC = createBuilding(new THREE.Vector3(3.8, 4.8, 3.8), new THREE.Vector3(6.2, 0, -1.6), '#0b3354', '实验楼', 'building-c');
  const pvArray = createPvArray();
  const acStation = createAcStation();
  const storage = createStorage();
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
      'pv-storage',
      [new THREE.Vector3(-4, 6.3, 0.3), new THREE.Vector3(-6.5, 5.1, 4.6), new THREE.Vector3(-8.8, 2.6, 6.2)],
      '#15f5ba',
      0.14,
    ),
    createFlowPath(
      'pv-ac',
      [new THREE.Vector3(-2.2, 6.3, 0.8), new THREE.Vector3(0.4, 5.2, 4), new THREE.Vector3(4.2, 2.2, 5.7)],
      '#3de1ff',
      0.16,
    ),
    createFlowPath(
      'storage-ac',
      [new THREE.Vector3(-8.4, 2.1, 6.2), new THREE.Vector3(-2.4, 2.8, 6.6), new THREE.Vector3(4.4, 1.6, 5.8)],
      '#ffd66b',
      0.22,
    ),
    createFlowPath(
      'grid-ac',
      [new THREE.Vector3(12.5, 4.6, 4.8), new THREE.Vector3(11, 3.2, 5.5), new THREE.Vector3(6.8, 1.8, 5.8)],
      '#ff9d7f',
      0.12,
    ),
  ];

  flows.forEach((flow) => {
    flowGroup.add(flow.line);
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

    const flowVisibility: Record<ScenarioMode, Record<string, number>> = {
      normal: { 'pv-storage': 0.84, 'pv-ac': 1, 'storage-ac': 0.6, 'grid-ac': 0.24 },
      heatwave: { 'pv-storage': 0.72, 'pv-ac': 1, 'storage-ac': 0.9, 'grid-ac': 0.38 },
      cloudy: { 'pv-storage': 0.3, 'pv-ac': 0.42, 'storage-ac': 0.86, 'grid-ac': 0.62 },
      peakPricing: { 'pv-storage': 0.9, 'pv-ac': 0.76, 'storage-ac': 1, 'grid-ac': 0.18 },
    };

    flows.forEach((flow) => {
      flow.visibleFactor = flowVisibility[nextScenario][flow.id];
      (flow.line.material as THREE.LineBasicMaterial).opacity = 0.12 + flow.visibleFactor * 0.46;
    });
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
    const elapsed = clock.getElapsedTime();
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

    flows.forEach((flow) => {
      flow.particles.forEach((particle, index) => {
        const t = (elapsed * flow.speed * (0.9 + flow.visibleFactor) + particle.offset) % 1;
        flow.curve.getPointAt(t, particle.mesh.position);
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
      renderer.dispose();
      container.removeChild(renderer.domElement);
    },
  };
};
