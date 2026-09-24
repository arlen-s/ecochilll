import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { FocusView, OperatingMode, ScenarioMode, ThermalStorageMetrics } from '@/types/energy';
import { deriveThermalVisualState } from './thermalVisualState';
import { createCampusBuilding } from './campusBuildings';
import { createAcStation, createGridGateway, createPvArray } from './energyEquipment';
import { createThermalTank } from './thermalTankModel';
import { createEnergyFlowPaths, type FlowPath } from './flowVisuals';

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

export const getResponsivePreset = (
  preset: { position: THREE.Vector3; target: THREE.Vector3 },
  aspect: number,
  focus: FocusView,
) => {
  if (aspect >= 1.45) {
    return {
      position: preset.position.clone(),
      target: preset.target.clone(),
    };
  }

  const aspectFactor = THREE.MathUtils.clamp((1.45 - aspect) / 0.55, 0, 1);
  const offset = preset.position.clone().sub(preset.target);
  offset.multiplyScalar(1 + aspectFactor * (focus === 'overview' ? 1.15 : 0.18));
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

  const flows: FlowPath[] = createEnergyFlowPaths();

  flows.forEach((flow) => {
    flowGroup.add(flow.pipe, flow.glow, flow.line);
    flow.particles.forEach((particle) => flowGroup.add(particle.mesh));
  });

  let hovered: THREE.Object3D | null = null;
  let selectedId = 'pv';
  let alertedIds = new Set<string>();
  let focus: FocusView = 'overview';
  let zoomScale = 1;
  const buildPresetForFocus = (nextFocus: FocusView) =>
    applyZoomScaleToPreset(
      getResponsivePreset(viewPresets[nextFocus], container.clientWidth / Math.max(container.clientHeight, 1), nextFocus),
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
    const basePreset = getResponsivePreset(viewPresets[focus], container.clientWidth / Math.max(container.clientHeight, 1), focus);
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
