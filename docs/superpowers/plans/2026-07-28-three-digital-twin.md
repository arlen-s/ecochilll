# Three.js Digital Twin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the basic procedural scene with a layered, asset-backed futuristic campus digital twin that stays synchronized with the Mock simulation.

**Architecture:** Generate and bundle four project-owned GLB asset families, then compose them with independent environment, campus, energy-flow, interaction, and post-processing systems. `TwinSceneManager` owns lifecycle and frame scheduling; Vue only sends scenario snapshots and receives selection/progress events.

**Tech Stack:** Three.js, GLTFLoader, Meshopt, EffectComposer, OrbitControls, CSS2DRenderer, TypeScript, Vitest

---

## Execution Order

This is plan 3 of 4. Start only after `2026-07-28-command-center-ui.md` passes. Do not redesign UI components in this plan except `EnergyTwinScene.vue` and scene-local HUD/loading states.

## File Map

**Create:**

- `src/three/types.ts` — stable manager, asset, quality, and event contracts.
- `src/three/quality.ts` — deterministic renderer-quality selection.
- `src/three/quality.spec.ts`
- `src/three/core/ResourceTracker.ts` — recursive GPU resource cleanup.
- `src/three/core/AssetLoader.ts` — GLB manifest loading, progress, and fallback.
- `src/three/core/AssetLoader.spec.ts`
- `src/three/core/TwinSceneManager.ts` — renderer, camera, systems, and frame lifecycle.
- `src/three/assets/manifest.ts` — bundled model URLs and licenses.
- `src/three/assets/fallbacks.ts` — low-detail fallback groups.
- `src/three/systems/EnvironmentSystem.ts` — base, lights, atmosphere, and scenario palette.
- `src/three/systems/environmentState.ts` — pure scenario-to-visual mapping.
- `src/three/systems/environmentState.spec.ts`
- `src/three/systems/CampusSystem.ts` — GLB placement and device map.
- `src/three/systems/EnergyFlowSystem.ts` — energy tubes and moving particles.
- `src/three/systems/energyFlowState.ts` — pure snapshot-to-flow mapping.
- `src/three/systems/energyFlowState.spec.ts`
- `src/three/systems/DeviceInteractionSystem.ts` — raycasting, labels, and selection.
- `src/three/postprocessing/PostProcessingPipeline.ts` — selective Bloom and quality effects.
- `scripts/generate-twin-assets.mjs` — reproducible project-owned model generation.
- `public/models/twin/building.glb`
- `public/models/twin/solar-array.glb`
- `public/models/twin/chiller.glb`
- `public/models/twin/battery-rack.glb`
- `public/models/twin/LICENSES.md`

**Modify:**

- `package.json`
- `package-lock.json`
- `src/components/three/EnergyTwinScene.vue`
- `src/views/DashboardView.vue` — lazy-load the scene component.

**Delete after migration:**

- `src/three/createEnergyScene.ts`

## Task 1: Define Quality and Scene Contracts

**Files:**

- Create: `src/three/types.ts`
- Create: `src/three/quality.ts`
- Create: `src/three/quality.spec.ts`

- [ ] **Step 1: Write failing quality-selection tests**

Create `src/three/quality.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveRenderQuality } from './quality';

describe('resolveRenderQuality', () => {
  it('uses high quality only for capable wide desktops', () => {
    expect(resolveRenderQuality({ width: 1920, dpr: 2, hardwareConcurrency: 10, reducedMotion: false })).toBe('high');
  });

  it('uses low quality for mobile or reduced motion', () => {
    expect(resolveRenderQuality({ width: 390, dpr: 3, hardwareConcurrency: 8, reducedMotion: false })).toBe('low');
    expect(resolveRenderQuality({ width: 1920, dpr: 1, hardwareConcurrency: 12, reducedMotion: true })).toBe('low');
  });

  it('uses medium quality for ordinary laptops', () => {
    expect(resolveRenderQuality({ width: 1366, dpr: 1, hardwareConcurrency: 6, reducedMotion: false })).toBe('medium');
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```bash
npm test -- src/three/quality.spec.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Define the shared Three.js contracts**

Create `src/three/types.ts`:

```ts
import type * as THREE from 'three';
import type { FocusView, LiveDashboardSnapshot, ScenarioMode, SystemAlert } from '@/types/energy';

export type RenderQuality = 'low' | 'medium' | 'high';
export type TwinAssetId = 'building' | 'solar-array' | 'chiller' | 'battery-rack';

export interface QualityInputs {
  width: number;
  dpr: number;
  hardwareConcurrency: number;
  reducedMotion: boolean;
}

export interface TwinAssetDefinition {
  id: TwinAssetId;
  url: string;
  label: string;
  license: string;
}

export interface TwinAssetBundle {
  models: Map<TwinAssetId, THREE.Group>;
  failed: TwinAssetId[];
}

export interface TwinSceneCallbacks {
  onProgress?: (progress: number) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
  onHover?: (payload: { id: string; label: string; x: number; y: number } | null) => void;
  onSelect?: (id: string) => void;
}

export interface TwinSceneApi {
  setFocus(focus: FocusView): void;
  updateScenario(scenario: ScenarioMode): void;
  updateSnapshot(snapshot: LiveDashboardSnapshot): void;
  updateAlerts(alerts: SystemAlert[]): void;
  updateSelected(nodeId: string): void;
  zoomBy(factor: number): void;
  resetCamera(): void;
  resize(): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}
```

- [ ] **Step 4: Implement quality selection**

Create `src/three/quality.ts`:

```ts
import type { QualityInputs, RenderQuality } from './types';

export const resolveRenderQuality = (inputs: QualityInputs): RenderQuality => {
  if (inputs.reducedMotion || inputs.width < 720 || inputs.hardwareConcurrency <= 4) return 'low';
  if (inputs.width >= 1600 && inputs.hardwareConcurrency >= 8 && inputs.dpr <= 2.5) return 'high';
  return 'medium';
};

export const pixelRatioForQuality = (quality: RenderQuality, devicePixelRatio: number) => ({
  low: Math.min(devicePixelRatio, 1),
  medium: Math.min(devicePixelRatio, 1.35),
  high: Math.min(devicePixelRatio, 1.65),
})[quality];
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- src/three/quality.spec.ts
npm run type-check
```

Expected: three quality tests pass and type checking succeeds.

```bash
git add src/three/types.ts src/three/quality.ts src/three/quality.spec.ts
git commit -m "feat: define digital twin quality contracts"
```

## Task 2: Generate and Bundle Project-Owned GLB Assets

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/generate-twin-assets.mjs`
- Create: `public/models/twin/*.glb`
- Create: `public/models/twin/LICENSES.md`

- [ ] **Step 1: Install the asset optimizer**

Run:

```bash
npm install --save-dev @gltf-transform/cli meshoptimizer
```

Expected: npm exits with code 0.

- [ ] **Step 2: Add the reproducible asset-generation script**

Create `scripts/generate-twin-assets.mjs`. The script must use `RoundedBoxGeometry`, PBR materials, bevelled silhouettes, repeated facade/vent details, and `GLTFExporter`; it must not download runtime assets.

Use this complete structure:

```js
import { mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

class NodeFileReader {
  result = null;
  onloadend = null;
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }
  async readAsDataURL(blob) {
    const bytes = Buffer.from(await blob.arrayBuffer());
    this.result = `data:${blob.type};base64,${bytes.toString('base64')}`;
    this.onloadend?.();
  }
}
globalThis.FileReader = NodeFileReader;

const outputDir = new URL('../public/models/twin/', import.meta.url);
const sourceDir = new URL('../.asset-source/twin/', import.meta.url);
await mkdir(outputDir, { recursive: true });
await mkdir(sourceDir, { recursive: true });

const material = (name, color, metalness = 0.35, roughness = 0.48, emissive = '#000000') => {
  const value = new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: 0.45 });
  value.name = name;
  return value;
};
const darkMetal = material('Dark metal', '#11191d', 0.72, 0.28);
const alloy = material('Brushed alloy', '#526166', 0.8, 0.24);
const glass = material('Cold glass', '#17303a', 0.3, 0.18, '#071a20');
const cyan = material('Cyan signal', '#136b70', 0.48, 0.2, '#24c9c5');
const green = material('Green signal', '#155e42', 0.4, 0.22, '#3bdc8a');
const panelBlue = material('Solar cells', '#102a37', 0.66, 0.16, '#082a32');

const mesh = (geometry, value, position = [0, 0, 0]) => {
  const object = new THREE.Mesh(geometry, value);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
};

const buildBuilding = () => {
  const root = new THREE.Group();
  root.name = 'CampusBuilding';
  root.add(mesh(new RoundedBoxGeometry(7, 5.8, 5, 5, 0.28), darkMetal, [0, 2.9, 0]));
  root.add(mesh(new RoundedBoxGeometry(5.6, 1.1, 3.8, 4, 0.18), alloy, [0, 6.05, 0]));
  root.add(mesh(new RoundedBoxGeometry(2.4, 0.45, 2.4, 4, 0.14), cyan, [0, 6.82, 0]));
  for (const side of [-1, 1]) {
    for (let floor = 0; floor < 4; floor += 1) {
      for (let col = 0; col < 5; col += 1) {
        const window = mesh(new RoundedBoxGeometry(0.62, 0.56, 0.08, 2, 0.05), glass, [-2.55 + col * 1.28, 1.25 + floor * 1.15, side * 2.51]);
        root.add(window);
      }
    }
  }
  for (let floor = 0; floor < 4; floor += 1) {
    root.add(mesh(new THREE.BoxGeometry(7.12, 0.08, 5.12), cyan, [0, 1.12 + floor * 1.15, 0]));
  }
  return root;
};

const buildSolarArray = () => {
  const root = new THREE.Group();
  root.name = 'SolarArray';
  root.add(mesh(new THREE.BoxGeometry(7.6, 0.18, 3.9), darkMetal, [0, 0.15, 0]));
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const panel = new THREE.Group();
      panel.position.set(-3.1 + col * 1.24, 0.55 + row * 0.1, -1.25 + row * 1.2);
      panel.rotation.x = -0.18;
      panel.add(mesh(new RoundedBoxGeometry(1.08, 0.08, 0.92, 2, 0.04), panelBlue));
      panel.add(mesh(new THREE.BoxGeometry(1.13, 0.035, 0.97), alloy, [0, -0.05, 0]));
      for (let cell = -1; cell <= 1; cell += 1) {
        panel.add(mesh(new THREE.BoxGeometry(0.02, 0.012, 0.8), cyan, [cell * 0.3, 0.052, 0]));
      }
      root.add(panel);
    }
  }
  return root;
};

const buildChiller = () => {
  const root = new THREE.Group();
  root.name = 'ChillerPlant';
  root.add(mesh(new RoundedBoxGeometry(6.4, 2.5, 4.2, 5, 0.3), alloy, [0, 1.25, 0]));
  root.add(mesh(new RoundedBoxGeometry(5.8, 1.6, 3.6, 4, 0.2), darkMetal, [0, 1.3, 0]));
  for (let x = -2; x <= 2; x += 2) {
    const fan = mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.28, 32), darkMetal, [x, 2.65, 0.8]);
    fan.rotation.x = Math.PI / 2;
    root.add(fan);
    const ring = mesh(new THREE.TorusGeometry(0.72, 0.06, 12, 40), cyan, [x, 2.65, 0.95]);
    root.add(ring);
  }
  for (const z of [-1.5, 1.5]) {
    const pipe = mesh(new THREE.CylinderGeometry(0.22, 0.22, 5.8, 20), green, [0, 0.38, z]);
    pipe.rotation.z = Math.PI / 2;
    root.add(pipe);
  }
  return root;
};

const buildBatteryRack = () => {
  const root = new THREE.Group();
  root.name = 'BatteryRack';
  root.add(mesh(new RoundedBoxGeometry(4.8, 5.6, 2.4, 5, 0.24), darkMetal, [0, 2.8, 0]));
  for (let bay = -1; bay <= 1; bay += 1) {
    for (let row = 0; row < 6; row += 1) {
      root.add(mesh(new RoundedBoxGeometry(1.28, 0.54, 0.16, 2, 0.04), alloy, [bay * 1.45, 0.75 + row * 0.78, 1.22]));
      root.add(mesh(new THREE.BoxGeometry(0.84, 0.08, 0.04), green, [bay * 1.45, 0.75 + row * 0.78, 1.33]));
    }
  }
  root.add(mesh(new RoundedBoxGeometry(3.9, 0.42, 0.18, 2, 0.05), cyan, [0, 5.15, 1.25]));
  return root;
};

const exporter = new GLTFExporter();
const exportBinary = async (name, root) => {
  const binary = await exporter.parseAsync(root, { binary: true, onlyVisible: true });
  await writeFile(new URL(`${name}.source.glb`, sourceDir), Buffer.from(binary));
};

await exportBinary('building', buildBuilding());
await exportBinary('solar-array', buildSolarArray());
await exportBinary('chiller', buildChiller());
await exportBinary('battery-rack', buildBatteryRack());
```

- [ ] **Step 3: Generate and optimize each model**

Run:

```bash
node scripts/generate-twin-assets.mjs
npx gltf-transform optimize .asset-source/twin/building.source.glb public/models/twin/building.glb --compress meshopt
npx gltf-transform optimize .asset-source/twin/solar-array.source.glb public/models/twin/solar-array.glb --compress meshopt
npx gltf-transform optimize .asset-source/twin/chiller.source.glb public/models/twin/chiller.glb --compress meshopt
npx gltf-transform optimize .asset-source/twin/battery-rack.source.glb public/models/twin/battery-rack.glb --compress meshopt
```

Expected: four optimized `.glb` files are produced and each is smaller than its `.source.glb` input.

- [ ] **Step 4: Record asset ownership and licenses**

Create `public/models/twin/LICENSES.md`:

```markdown
# EcoChill Twin Asset Licenses

The following GLB assets are original project assets generated by
`scripts/generate-twin-assets.mjs` from Three.js primitives:

- `building.glb`
- `solar-array.glb`
- `chiller.glb`
- `battery-rack.glb`

Copyright belongs to the EcoChill project. No third-party geometry, texture,
logo, or downloaded model is embedded in these files.

Three.js is used under the MIT License. Meshopt compression uses meshoptimizer
under the MIT License. Dependency license texts remain available through the
corresponding npm packages.
```

- [ ] **Step 5: Add a regeneration command**

Add to `package.json`:

```json
{
  "assets:twin": "node scripts/generate-twin-assets.mjs"
}
```

The optimized GLBs are committed artifacts; running `assets:twin` regenerates source GLBs, while the four explicit `gltf-transform optimize` commands reproduce deployable files.

- [ ] **Step 6: Validate all assets can be inspected**

Run:

```bash
npx gltf-transform inspect public/models/twin/building.glb
npx gltf-transform inspect public/models/twin/solar-array.glb
npx gltf-transform inspect public/models/twin/chiller.glb
npx gltf-transform inspect public/models/twin/battery-rack.glb
```

Expected: all four commands report valid scenes, meshes, primitives, and `EXT_meshopt_compression`.

- [ ] **Step 7: Commit the asset pipeline**

```bash
git add package.json package-lock.json scripts/generate-twin-assets.mjs public/models/twin
git commit -m "feat: add optimized campus twin assets"
```

Do not add `.asset-source/` to Git. Add `.asset-source` to `.gitignore` in this commit.

## Task 3: Build Resource Tracking and Asset Loading

**Files:**

- Create: `src/three/core/ResourceTracker.ts`
- Create: `src/three/assets/manifest.ts`
- Create: `src/three/assets/fallbacks.ts`
- Create: `src/three/core/AssetLoader.ts`
- Create: `src/three/core/AssetLoader.spec.ts`

- [ ] **Step 1: Write the failing fallback test**

Create `src/three/core/AssetLoader.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { AssetLoader } from './AssetLoader';

describe('AssetLoader', () => {
  it('returns a named fallback and reports failed assets', async () => {
    const loadModel = vi.fn().mockRejectedValue(new Error('offline'));
    const loader = new AssetLoader(loadModel);
    const bundle = await loader.loadAll();
    expect(bundle.failed).toEqual(['building', 'solar-array', 'chiller', 'battery-rack']);
    expect(bundle.models.get('chiller')).toBeInstanceOf(THREE.Group);
    expect(bundle.models.get('chiller')?.userData.fallback).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```bash
npm test -- src/three/core/AssetLoader.spec.ts
```

Expected: FAIL because `AssetLoader` does not exist.

- [ ] **Step 3: Define the asset manifest**

Create `src/three/assets/manifest.ts`:

```ts
import type { TwinAssetDefinition } from '../types';

export const twinAssets: TwinAssetDefinition[] = [
  { id: 'building', url: '/models/twin/building.glb', label: '校园建筑', license: 'EcoChill original' },
  { id: 'solar-array', url: '/models/twin/solar-array.glb', label: '光伏阵列', license: 'EcoChill original' },
  { id: 'chiller', url: '/models/twin/chiller.glb', label: '空调冷站', license: 'EcoChill original' },
  { id: 'battery-rack', url: '/models/twin/battery-rack.glb', label: '储能柜', license: 'EcoChill original' },
];
```

- [ ] **Step 4: Implement deterministic low-detail fallbacks**

Create `src/three/assets/fallbacks.ts`:

```ts
import * as THREE from 'three';
import type { TwinAssetId } from '../types';

const material = new THREE.MeshStandardMaterial({ color: '#273438', metalness: 0.45, roughness: 0.55 });
const dimensions: Record<TwinAssetId, [number, number, number]> = {
  building: [6, 5, 4],
  'solar-array': [6, 0.35, 3],
  chiller: [5, 2, 3],
  'battery-rack': [3, 4.5, 2],
};

export const createAssetFallback = (id: TwinAssetId) => {
  const group = new THREE.Group();
  const [x, y, z] = dimensions[id];
  const body = new THREE.Mesh(new THREE.BoxGeometry(x, y, z), material.clone());
  body.position.y = y / 2;
  group.add(body);
  group.name = `${id}-fallback`;
  group.userData.fallback = true;
  return group;
};
```

- [ ] **Step 5: Implement resource tracking**

Create `src/three/core/ResourceTracker.ts`:

```ts
import * as THREE from 'three';

const disposeMaterial = (material: THREE.Material) => {
  Object.values(material).forEach((value) => {
    if (value instanceof THREE.Texture) value.dispose();
  });
  material.dispose();
};

export class ResourceTracker {
  disposeObject(root: THREE.Object3D) {
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) mesh.material.forEach(disposeMaterial);
      else if (mesh.material) disposeMaterial(mesh.material);
    });
    root.removeFromParent();
  }
}
```

- [ ] **Step 6: Implement the GLB loader with Meshopt and fallback**

Create `src/three/core/AssetLoader.ts`:

```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { twinAssets } from '../assets/manifest';
import { createAssetFallback } from '../assets/fallbacks';
import type { TwinAssetBundle, TwinAssetDefinition, TwinAssetId } from '../types';

type LoadModel = (asset: TwinAssetDefinition) => Promise<THREE.Group>;

export class AssetLoader {
  private readonly loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

  constructor(
    private readonly loadModel: LoadModel = async (asset) => {
      const gltf = await this.loader.loadAsync(asset.url);
      return gltf.scene;
    },
    private readonly onProgress: (progress: number) => void = () => undefined,
  ) {}

  async loadAll(): Promise<TwinAssetBundle> {
    const models = new Map<TwinAssetId, THREE.Group>();
    const failed: TwinAssetId[] = [];
    let completed = 0;
    await Promise.all(twinAssets.map(async (asset) => {
      try {
        const model = await this.loadModel(asset);
        model.name = asset.id;
        models.set(asset.id, model);
      } catch {
        failed.push(asset.id);
        models.set(asset.id, createAssetFallback(asset.id));
      } finally {
        completed += 1;
        this.onProgress(completed / twinAssets.length);
      }
    }));
    return { models, failed };
  }
}
```

- [ ] **Step 7: Run tests, type check, and commit**

Run:

```bash
npm test -- src/three/core/AssetLoader.spec.ts
npm run type-check
```

Expected: fallback test passes and TypeScript accepts Meshopt decoder wiring.

```bash
git add src/three/core src/three/assets
git commit -m "feat: add resilient twin asset loader"
```

## Task 4: Build the Environment System

**Files:**

- Create: `src/three/systems/environmentState.ts`
- Create: `src/three/systems/environmentState.spec.ts`
- Create: `src/three/systems/EnvironmentSystem.ts`

- [ ] **Step 1: Write failing scenario visual-state tests**

Create `src/three/systems/environmentState.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { environmentStateForScenario } from './environmentState';

describe('environment state', () => {
  it('reduces light and increases cloud opacity for cloudy mode', () => {
    const normal = environmentStateForScenario('normal');
    const cloudy = environmentStateForScenario('cloudy');
    expect(cloudy.sunIntensity).toBeLessThan(normal.sunIntensity);
    expect(cloudy.cloudOpacity).toBeGreaterThan(normal.cloudOpacity);
  });

  it('exposes heat distortion only for heatwave mode', () => {
    expect(environmentStateForScenario('heatwave').heatStrength).toBeGreaterThan(0);
    expect(environmentStateForScenario('peakPricing').heatStrength).toBe(0);
  });
});
```

- [ ] **Step 2: Implement the pure state mapping**

Create `src/three/systems/environmentState.ts`:

```ts
import type { ScenarioMode } from '@/types/energy';

export const environmentStateForScenario = (scenario: ScenarioMode) => ({
  normal: { sunIntensity: 2.4, cloudOpacity: 0.12, heatStrength: 0, exposure: 1.05, accent: '#3fe0da' },
  heatwave: { sunIntensity: 3.0, cloudOpacity: 0.08, heatStrength: 0.62, exposure: 1.14, accent: '#f2b84b' },
  cloudy: { sunIntensity: 1.25, cloudOpacity: 0.42, heatStrength: 0, exposure: 0.88, accent: '#6aa9ff' },
  peakPricing: { sunIntensity: 1.9, cloudOpacity: 0.18, heatStrength: 0, exposure: 1, accent: '#54dc91' },
})[scenario];
```

- [ ] **Step 3: Run the tests and confirm they pass**

Run:

```bash
npm test -- src/three/systems/environmentState.spec.ts
```

Expected: two tests pass.

- [ ] **Step 4: Implement the environment scene layer**

Create `src/three/systems/EnvironmentSystem.ts` with these owned objects and methods:

```ts
import * as THREE from 'three';
import type { RenderQuality } from '../types';
import type { ScenarioMode } from '@/types/energy';
import { environmentStateForScenario } from './environmentState';

export class EnvironmentSystem {
  readonly group = new THREE.Group();
  private readonly sun = new THREE.DirectionalLight('#fff2d2', 2.4);
  private readonly clouds: THREE.Points;
  private readonly scanRing: THREE.Mesh;
  private readonly heatHaze: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;

  constructor(private readonly scene: THREE.Scene, quality: RenderQuality) {
    scene.background = new THREE.Color('#05090b');
    scene.fog = new THREE.FogExp2('#071014', quality === 'low' ? 0.018 : 0.012);
    scene.add(new THREE.HemisphereLight('#8fbfc2', '#101617', 1.25), this.sun, this.group);
    this.sun.position.set(12, 24, -10);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(18.5, 20, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: '#0b1114', metalness: 0.7, roughness: 0.48 }),
    );
    base.position.y = -0.62;
    base.receiveShadow = true;
    this.group.add(base);

    const grid = new THREE.GridHelper(34, 34, '#236a6c', '#172629');
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.28;
    grid.position.y = 0.02;
    this.group.add(grid);

    this.scanRing = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.24, 96),
      new THREE.MeshBasicMaterial({ color: '#3fe0da', transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    this.scanRing.rotation.x = -Math.PI / 2;
    this.scanRing.position.y = 0.08;
    this.group.add(this.scanRing);

    this.heatHaze = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 9, 1, 1),
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uStrength: { value: 0 } },
        vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: 'uniform float uTime;uniform float uStrength;varying vec2 vUv;void main(){float wave=sin(vUv.y*82.0+uTime*2.4)+sin(vUv.x*39.0-uTime*1.7);float alpha=smoothstep(0.65,1.75,wave)*0.055*uStrength;gl_FragColor=vec4(0.95,0.58,0.24,alpha);}',
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.heatHaze.position.set(0, 5.2, -7.5);
    this.group.add(this.heatHaze);

    let seed = 20260728;
    const random = () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const positions = new Float32Array((quality === 'high' ? 120 : 64) * 3);
    for (let index = 0; index < positions.length; index += 3) {
      positions[index] = (random() - 0.5) * 38;
      positions[index + 1] = 10 + random() * 6;
      positions[index + 2] = (random() - 0.5) * 24;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.clouds = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#a9bec3', size: 2.2, transparent: true, opacity: 0.12, depthWrite: false }));
    this.group.add(this.clouds);
  }

  setScenario(scenario: ScenarioMode) {
    const state = environmentStateForScenario(scenario);
    this.sun.intensity = state.sunIntensity;
    (this.clouds.material as THREE.PointsMaterial).opacity = state.cloudOpacity;
    (this.scanRing.material as THREE.MeshBasicMaterial).color.set(state.accent);
    this.heatHaze.material.uniforms.uStrength.value = state.heatStrength;
  }

  update(elapsed: number) {
    const scale = 1 + (elapsed * 0.22) % 12;
    this.scanRing.scale.setScalar(scale);
    (this.scanRing.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - ((scale - 1) / 12));
    this.clouds.position.x = Math.sin(elapsed * 0.06) * 1.2;
    this.heatHaze.material.uniforms.uTime.value = elapsed;
  }
}
```

- [ ] **Step 5: Type-check and commit**

Run:

```bash
npm run type-check
```

Expected: PASS.

```bash
git add src/three/systems/environmentState.ts src/three/systems/environmentState.spec.ts src/three/systems/EnvironmentSystem.ts
git commit -m "feat: add scenario-aware twin environment"
```

## Task 5: Build the Campus and Energy-Flow Systems

**Files:**

- Create: `src/three/systems/CampusSystem.ts`
- Create: `src/three/systems/energyFlowState.ts`
- Create: `src/three/systems/energyFlowState.spec.ts`
- Create: `src/three/systems/EnergyFlowSystem.ts`

- [ ] **Step 1: Write failing flow-state tests**

Create `src/three/systems/energyFlowState.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deriveEnergyFlows } from './energyFlowState';
import { buildScenarioData, deriveLiveSnapshot } from '@/mock/energyMock';

describe('deriveEnergyFlows', () => {
  it('maps one snapshot to four non-negative paths', () => {
    const data = buildScenarioData('peakPricing');
    const snapshot = deriveLiveSnapshot(data, 19);
    const flows = deriveEnergyFlows(snapshot);
    expect(Object.keys(flows)).toEqual(['pv-storage', 'pv-ac', 'storage-ac', 'grid-ac']);
    expect(Object.values(flows).every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it('increases storage-to-AC emphasis during peak discharge', () => {
    const data = buildScenarioData('peakPricing');
    expect(deriveEnergyFlows(deriveLiveSnapshot(data, 19))['storage-ac'])
      .toBeGreaterThan(deriveEnergyFlows(deriveLiveSnapshot(data, 8))['storage-ac']);
  });
});
```

- [ ] **Step 2: Implement pure flow derivation**

Create `src/three/systems/energyFlowState.ts`:

```ts
import type { LiveDashboardSnapshot } from '@/types/energy';

const normalized = (value: number, ceiling: number) => Math.min(1, Math.max(0, value / ceiling));

export const deriveEnergyFlows = (snapshot: LiveDashboardSnapshot) => ({
  'pv-storage': normalized(snapshot.storage.chargePowerKw, 160),
  'pv-ac': normalized(Math.min(snapshot.photovoltaic.powerKw, snapshot.airConditioning.totalLoadKw), 420),
  'storage-ac': normalized(snapshot.storage.dischargePowerKw, 180),
  'grid-ac': normalized(snapshot.gridImportKw, 360),
});
```

- [ ] **Step 3: Implement asset placement and node IDs**

Create `src/three/systems/CampusSystem.ts`:

```ts
import * as THREE from 'three';
import type { TwinAssetBundle } from '../types';

interface Placement { asset: 'building' | 'solar-array' | 'chiller' | 'battery-rack'; id: string; label: string; position: [number, number, number]; rotationY?: number; scale?: number; }
const placements: Placement[] = [
  { asset: 'building', id: 'building-a', label: '教学楼 A', position: [-6.4, 0, -1.8], scale: 0.72 },
  { asset: 'building', id: 'building-b', label: '图书馆', position: [0, 0, 0.2], rotationY: Math.PI / 2, scale: 0.82 },
  { asset: 'building', id: 'building-c', label: '实验楼', position: [6.4, 0, -2.4], scale: 0.66 },
  { asset: 'solar-array', id: 'pv', label: '屋顶光伏阵列', position: [-4.2, 5.3, -0.7], scale: 0.62 },
  { asset: 'chiller', id: 'ac', label: '空调冷站', position: [5.8, 0, 5.6], rotationY: -0.35, scale: 0.72 },
  { asset: 'battery-rack', id: 'storage', label: '储能系统', position: [-8.8, 0, 6], scale: 0.72 },
];

export class CampusSystem {
  readonly group = new THREE.Group();
  readonly interactive = new Map<string, THREE.Object3D>();

  constructor(bundle: TwinAssetBundle) {
    placements.forEach((placement) => {
      const source = bundle.models.get(placement.asset)!;
      const model = source.clone(true);
      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map((item) => item.clone())
          : mesh.material.clone();
      });
      model.position.set(...placement.position);
      model.rotation.y = placement.rotationY ?? 0;
      model.scale.setScalar(placement.scale ?? 1);
      model.userData = { ...model.userData, id: placement.id, label: placement.label, interactive: true };
      this.group.add(model);
      this.interactive.set(placement.id, model);
    });
    const gateway = new THREE.Group();
    gateway.userData = { id: 'grid', label: '电网接口', interactive: true };
    const mastMaterial = new THREE.MeshStandardMaterial({ color: '#526166', metalness: 0.82, roughness: 0.28 });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 7, 8), mastMaterial);
    mast.position.y = 3.5;
    gateway.add(mast);
    gateway.position.set(11.8, 0, 4.6);
    this.group.add(gateway);
    this.interactive.set('grid', gateway);
  }
}
```

- [ ] **Step 4: Implement animated flow tubes**

Create `src/three/systems/EnergyFlowSystem.ts` with four paths and instanced particles:

```ts
import * as THREE from 'three';
import type { LiveDashboardSnapshot } from '@/types/energy';
import type { RenderQuality } from '../types';
import { deriveEnergyFlows } from './energyFlowState';

const definitions = [
  { id: 'pv-storage', color: '#54dc91', points: [[-4, 5.4, -0.5], [-6, 4, 3], [-8.6, 1.2, 5.8]] },
  { id: 'pv-ac', color: '#3fe0da', points: [[-3, 5.2, 0], [0, 4.2, 3], [5.3, 1.1, 5.4]] },
  { id: 'storage-ac', color: '#f2b84b', points: [[-8.4, 1.1, 6], [-2, 1.8, 7], [5.2, 1.2, 5.7]] },
  { id: 'grid-ac', color: '#6aa9ff', points: [[11.7, 4.5, 4.5], [9.5, 3.1, 5.5], [6.1, 1.4, 5.7]] },
] as const;

export class EnergyFlowSystem {
  readonly group = new THREE.Group();
  private readonly flows = definitions.map((definition) => {
    const curve = new THREE.CatmullRomCurve3(definition.points.map((point) => new THREE.Vector3(...point)));
    const material = new THREE.MeshBasicMaterial({ color: definition.color, transparent: true, opacity: 0.45 });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.045, 8, false), material);
    tube.layers.enable(1);
    this.group.add(tube);
    return { ...definition, curve, tube, intensity: 0 };
  });
  private readonly particles: THREE.Mesh[] = [];

  constructor(quality: RenderQuality) {
    const count = quality === 'high' ? 8 : quality === 'medium' ? 5 : 3;
    this.flows.forEach((flow) => {
      for (let index = 0; index < count; index += 1) {
        const particle = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 8, 8),
          new THREE.MeshBasicMaterial({ color: flow.color, transparent: true }),
        );
        particle.userData = { flowId: flow.id, offset: index / count };
        particle.layers.enable(1);
        this.group.add(particle);
        this.particles.push(particle);
      }
    });
  }

  updateSnapshot(snapshot: LiveDashboardSnapshot) {
    const values = deriveEnergyFlows(snapshot);
    this.flows.forEach((flow) => { flow.intensity = values[flow.id]; });
  }

  update(elapsed: number) {
    this.particles.forEach((particle) => {
      const flow = this.flows.find((item) => item.id === particle.userData.flowId)!;
      const t = (elapsed * (0.08 + flow.intensity * 0.24) + particle.userData.offset) % 1;
      flow.curve.getPointAt(t, particle.position);
      particle.visible = flow.intensity > 0.03;
      particle.scale.setScalar(0.65 + flow.intensity * 1.25);
      (particle.material as THREE.MeshBasicMaterial).opacity = 0.2 + flow.intensity * 0.8;
      (flow.tube.material as THREE.MeshBasicMaterial).opacity = 0.12 + flow.intensity * 0.5;
    });
  }
}
```

- [ ] **Step 5: Run focused tests and type check**

Run:

```bash
npm test -- src/three/systems/energyFlowState.spec.ts
npm run type-check
```

Expected: two flow tests pass and the new systems type-check.

- [ ] **Step 6: Commit campus and flow systems**

```bash
git add src/three/systems/CampusSystem.ts src/three/systems/EnergyFlowSystem.ts src/three/systems/energyFlowState.ts src/three/systems/energyFlowState.spec.ts
git commit -m "feat: add campus and live energy flow systems"
```

## Task 6: Build Device Interaction and Spatial Labels

**Files:**

- Create: `src/three/systems/DeviceInteractionSystem.ts`

- [ ] **Step 1: Implement throttled raycasting and labels**

Create `src/three/systems/DeviceInteractionSystem.ts`:

```ts
import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { TwinSceneCallbacks } from '../types';

export class DeviceInteractionSystem {
  readonly labelRenderer = new CSS2DRenderer();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly labels = new Map<string, HTMLElement>();
  private hovered: THREE.Object3D | null = null;
  private lastRaycastAt = 0;

  constructor(
    private readonly container: HTMLElement,
    private readonly camera: THREE.Camera,
    private readonly canvas: HTMLCanvasElement,
    private readonly devices: Map<string, THREE.Object3D>,
    private readonly callbacks: TwinSceneCallbacks,
  ) {
    this.labelRenderer.domElement.className = 'twin-spatial-labels';
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.inset = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(this.labelRenderer.domElement);
    devices.forEach((object) => {
      const label = document.createElement('button');
      label.className = 'twin-spatial-label';
      label.type = 'button';
      label.textContent = object.userData.label;
      label.tabIndex = -1;
      label.hidden = true;
      this.labels.set(object.userData.id, label);
      const labelObject = new CSS2DObject(label);
      labelObject.position.set(0, 1.2, 0);
      object.add(labelObject);
    });
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('click', this.onClick);
  }

  private findDevice(object: THREE.Object3D | null) {
    let current = object;
    while (current && !current.userData.interactive) current = current.parent;
    return current;
  }

  private onPointerMove = (event: PointerEvent) => {
    const now = performance.now();
    if (now - this.lastRaycastAt < 32) return;
    this.lastRaycastAt = now;
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects([...this.devices.values()], true)[0]?.object ?? null;
    this.hovered = this.findDevice(hit);
    this.canvas.style.cursor = this.hovered ? 'pointer' : 'grab';
    this.callbacks.onHover?.(this.hovered ? { id: this.hovered.userData.id, label: this.hovered.userData.label, x: event.clientX - bounds.left, y: event.clientY - bounds.top } : null);
  };
  private onPointerLeave = () => { this.hovered = null; this.callbacks.onHover?.(null); };
  private onClick = () => { if (this.hovered?.userData.id) this.callbacks.onSelect?.(this.hovered.userData.id); };

  render(scene: THREE.Scene, camera: THREE.Camera) { this.labelRenderer.render(scene, camera); }
  setVisibleLabels(nodeIds: string[]) {
    const visible = new Set(nodeIds.slice(0, 3));
    this.labels.forEach((label, id) => { label.hidden = !visible.has(id); });
  }
  resize(width: number, height: number) { this.labelRenderer.setSize(width, height); }
  dispose() {
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('click', this.onClick);
    this.labelRenderer.domElement.remove();
  }
}
```

- [ ] **Step 2: Add shared spatial-label styles**

Add to the unscoped part of `src/style.scss`:

```scss
.twin-spatial-label {
  padding: 5px 8px;
  border: 1px solid rgba(63, 224, 218, 0.38);
  border-radius: 2px;
  background: rgba(5, 9, 11, 0.78);
  color: var(--text-primary);
  font-size: 10px;
  pointer-events: none;
  box-shadow: 0 0 18px rgba(63, 224, 218, 0.1);
}
```

- [ ] **Step 3: Type-check and commit**

Run:

```bash
npm run type-check
```

Expected: PASS.

```bash
git add src/three/systems/DeviceInteractionSystem.ts src/style.scss
git commit -m "feat: add spatial twin interaction labels"
```

## Task 7: Build Selective Post-Processing

**Files:**

- Create: `src/three/postprocessing/PostProcessingPipeline.ts`

- [ ] **Step 1: Implement the selective Bloom pipeline**

Create `src/three/postprocessing/PostProcessingPipeline.ts` using two composers. Objects on layer 1 are Bloom sources; other meshes are temporarily darkened during the Bloom render.

```ts
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import type { RenderQuality } from '../types';

const bloomLayer = new THREE.Layers();
bloomLayer.set(1);
const darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });

export class PostProcessingPipeline {
  private readonly bloomComposer: EffectComposer;
  private readonly finalComposer: EffectComposer;
  private readonly hiddenMaterials = new Map<string, THREE.Material | THREE.Material[]>();

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, quality: RenderQuality) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    this.bloomComposer = new EffectComposer(renderer);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(new RenderPass(scene, camera));
    this.bloomComposer.addPass(new UnrealBloomPass(size, quality === 'high' ? 1.05 : 0.72, 0.5, 0.78));

    const mixPass = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: this.bloomComposer.renderTarget2.texture },
      },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform sampler2D baseTexture;uniform sampler2D bloomTexture;varying vec2 vUv;void main(){gl_FragColor=texture2D(baseTexture,vUv)+vec4(texture2D(bloomTexture,vUv).rgb,0.0);}',
    }), 'baseTexture');
    this.finalComposer = new EffectComposer(renderer);
    this.finalComposer.addPass(new RenderPass(scene, camera));
    this.finalComposer.addPass(mixPass);
    if (quality === 'high') {
      this.finalComposer.addPass(new BokehPass(scene, camera, { focus: 18, aperture: 0.000018, maxblur: 0.0035 }));
    }
    const vignette = new ShaderPass(VignetteShader);
    vignette.uniforms.offset.value = 1.08;
    vignette.uniforms.darkness.value = 1.16;
    this.finalComposer.addPass(vignette);
    this.finalComposer.addPass(new OutputPass());
  }

  private darken = (object: THREE.Object3D) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && !bloomLayer.test(mesh.layers)) {
      this.hiddenMaterials.set(mesh.uuid, mesh.material);
      mesh.material = darkMaterial;
    }
  };
  private restore = (object: THREE.Object3D) => {
    const material = this.hiddenMaterials.get(object.uuid);
    if (material) { (object as THREE.Mesh).material = material; this.hiddenMaterials.delete(object.uuid); }
  };
  render(scene: THREE.Scene) {
    scene.traverse(this.darken);
    this.bloomComposer.render();
    scene.traverse(this.restore);
    this.finalComposer.render();
  }
  resize(width: number, height: number) { this.bloomComposer.setSize(width, height); this.finalComposer.setSize(width, height); }
  dispose() { this.bloomComposer.dispose(); this.finalComposer.dispose(); darkMaterial.dispose(); }
}
```

Low quality must bypass this class and call `renderer.render(scene, camera)` directly. Medium and high use the pipeline; only high uses the stronger Bloom values.

- [ ] **Step 2: Type-check and commit**

Run:

```bash
npm run type-check
```

Expected: PASS.

```bash
git add src/three/postprocessing/PostProcessingPipeline.ts
git commit -m "feat: add selective twin bloom pipeline"
```

## Task 8: Assemble TwinSceneManager

**Files:**

- Create: `src/three/core/TwinSceneManager.ts`

- [ ] **Step 1: Implement manager construction and async initialization**

Create `src/three/core/TwinSceneManager.ts`. It must:

```ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AssetLoader } from './AssetLoader';
import { ResourceTracker } from './ResourceTracker';
import { resolveRenderQuality, pixelRatioForQuality } from '../quality';
import { CampusSystem } from '../systems/CampusSystem';
import { DeviceInteractionSystem } from '../systems/DeviceInteractionSystem';
import { EnergyFlowSystem } from '../systems/EnergyFlowSystem';
import { EnvironmentSystem } from '../systems/EnvironmentSystem';
import { PostProcessingPipeline } from '../postprocessing/PostProcessingPipeline';
import type { AlertLevel, FocusView, LiveDashboardSnapshot, ScenarioMode, SystemAlert } from '@/types/energy';
import type { RenderQuality, TwinSceneApi, TwinSceneCallbacks } from '../types';

const presets: Record<FocusView, { position: [number, number, number]; target: [number, number, number] }> = {
  overview: { position: [19, 13, 22], target: [0, 2.7, 0] },
  pv: { position: [-6, 10, 13], target: [-4.2, 4.8, -0.5] },
  ac: { position: [11, 7, 13], target: [5.8, 1.5, 5.6] },
  storage: { position: [-13, 7, 13], target: [-8.8, 1.8, 6] },
};

export class TwinSceneManager implements TwinSceneApi {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly quality: RenderQuality;
  private readonly tracker = new ResourceTracker();
  private environment!: EnvironmentSystem;
  private campus!: CampusSystem;
  private flows!: EnergyFlowSystem;
  private interaction!: DeviceInteractionSystem;
  private postProcessing: PostProcessingPipeline | null = null;
  private desiredPosition = new THREE.Vector3(...presets.overview.position);
  private desiredTarget = new THREE.Vector3(...presets.overview.target);
  private selectedId = 'pv';
  private alerts = new Map<string, AlertLevel>();
  private focus: FocusView = 'overview';
  private transitionActive = true;
  private manualUntil = 0;
  private readonly orbitPosition = new THREE.Vector3();
  private readonly overviewTarget = new THREE.Vector3(...presets.overview.target);
  private frame = 0;
  private visible = true;
  private disposed = false;
  private readonly clock = new THREE.Clock();
  private readonly selectedSignal = new THREE.Color('#3fe0da');
  private readonly alertSignal = new THREE.Color('#f2b84b');
  private readonly dangerSignal = new THREE.Color('#ef6268');
  private readonly infoSignal = new THREE.Color('#6aa9ff');

  private updateDeviceMaterial(object: THREE.Object3D, boost: number, bloom: boolean, signal: THREE.Color | null) {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        const standard = material as THREE.MeshStandardMaterial;
        if (!standard.emissive) return;
        standard.userData.baseEmissiveIntensity ??= standard.emissiveIntensity;
        standard.userData.baseEmissiveColor ??= standard.emissive.getHex();
        standard.emissive.setHex(Number(standard.userData.baseEmissiveColor));
        if (signal) standard.emissive.lerp(signal, 0.58);
        standard.emissiveIntensity = Number(standard.userData.baseEmissiveIntensity) + boost;
      });
      if (bloom) mesh.layers.enable(1);
      else mesh.layers.disable(1);
    });
  }

  private refreshDeviceVisuals(elapsed: number) {
    this.campus.interactive.forEach((object, id) => {
      const selected = id === this.selectedId;
      const alertLevel = this.alerts.get(id);
      const alerted = Boolean(alertLevel);
      const pulse = alerted ? 0.24 + (Math.sin(elapsed * 4) + 1) * 0.22 : 0;
      const alertColor = alertLevel === 'high' ? this.dangerSignal : alertLevel === 'medium' ? this.alertSignal : this.infoSignal;
      const signal = selected ? this.selectedSignal : alerted ? alertColor : null;
      this.updateDeviceMaterial(object, (selected ? 0.32 : 0) + pulse, selected || alerted, signal);
    });
  }

  private constructor(private readonly container: HTMLElement, private readonly callbacks: TwinSceneCallbacks) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.quality = resolveRenderQuality({ width: container.clientWidth, dpr: window.devicePixelRatio, hardwareConcurrency: navigator.hardwareConcurrency || 4, reducedMotion });
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality !== 'low', alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = this.quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(pixelRatioForQuality(this.quality, window.devicePixelRatio));
    this.container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.1, 120);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 38;
    this.controls.addEventListener('start', () => {
      this.transitionActive = false;
      this.manualUntil = performance.now() + 8000;
    });
    this.controls.addEventListener('end', () => {
      this.desiredPosition.copy(this.camera.position);
      this.desiredTarget.copy(this.controls.target);
      this.manualUntil = performance.now() + 8000;
    });
  }

  static async create(container: HTMLElement, callbacks: TwinSceneCallbacks = {}) {
    const manager = new TwinSceneManager(container, callbacks);
    await manager.initialize();
    return manager;
  }
```

- [ ] **Step 2: Implement initialization and the frame loop**

Continue the class with:

```ts
  private async initialize() {
    this.environment = new EnvironmentSystem(this.scene, this.quality);
    const bundle = await new AssetLoader(undefined, (progress) => this.callbacks.onProgress?.(progress * 0.72)).loadAll();
    this.campus = new CampusSystem(bundle);
    this.flows = new EnergyFlowSystem(this.quality);
    this.scene.add(this.campus.group, this.flows.group);
    this.interaction = new DeviceInteractionSystem(this.container, this.camera, this.renderer.domElement, this.campus.interactive, this.callbacks);
    this.interaction.setVisibleLabels([this.selectedId]);
    if (this.quality !== 'low') this.postProcessing = new PostProcessingPipeline(this.renderer, this.scene, this.camera, this.quality);
    this.camera.position.copy(this.desiredPosition);
    this.controls.target.copy(this.desiredTarget);
    this.resize();
    this.callbacks.onProgress?.(1);
    if (bundle.failed.length) this.callbacks.onError?.(`部分模型已使用低模替代：${bundle.failed.join(', ')}`);
    this.callbacks.onReady?.();
    this.frame = requestAnimationFrame(this.animate);
  }

  private animate = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    if (!this.visible) return;
    const elapsed = this.clock.getElapsedTime();
    if (this.transitionActive) {
      this.camera.position.lerp(this.desiredPosition, 0.055);
      this.controls.target.lerp(this.desiredTarget, 0.075);
      if (this.camera.position.distanceTo(this.desiredPosition) < 0.04 && this.controls.target.distanceTo(this.desiredTarget) < 0.04) {
        this.transitionActive = false;
      }
    } else if (this.focus === 'overview' && performance.now() > this.manualUntil && this.quality !== 'low') {
      const preset = presets.overview;
      this.orbitPosition.set(
        preset.position[0] + Math.cos(elapsed * 0.12) * 1.8,
        preset.position[1] + Math.sin(elapsed * 0.17) * 0.35,
        preset.position[2] + Math.sin(elapsed * 0.12) * 1.8,
      );
      this.camera.position.lerp(this.orbitPosition, 0.018);
      this.controls.target.lerp(this.overviewTarget, 0.025);
    }
    this.controls.update();
    this.environment.update(elapsed);
    this.flows.update(elapsed);
    this.refreshDeviceVisuals(elapsed);
    if (this.postProcessing) this.postProcessing.render(this.scene);
    else this.renderer.render(this.scene, this.camera);
    this.interaction.render(this.scene, this.camera);
  };
```

- [ ] **Step 3: Implement the public API and complete disposal**

Finish the class:

```ts
  setFocus(focus: FocusView) {
    this.focus = focus;
    this.desiredPosition.set(...presets[focus].position);
    this.desiredTarget.set(...presets[focus].target);
    this.transitionActive = true;
  }
  updateScenario(scenario: ScenarioMode) { this.environment.setScenario(scenario); }
  updateSnapshot(snapshot: LiveDashboardSnapshot) { this.flows.updateSnapshot(snapshot); }
  updateAlerts(alerts: SystemAlert[]) {
    this.alerts = new Map(
      alerts
        .filter((alert) => this.campus.interactive.has(alert.nodeId))
        .map((alert) => [alert.nodeId, alert.level] as const),
    );
    this.interaction.setVisibleLabels([this.selectedId, ...this.alerts.keys()]);
  }
  updateSelected(nodeId: string) {
    if (!this.campus.interactive.has(nodeId)) return;
    this.selectedId = nodeId;
    this.interaction.setVisibleLabels([this.selectedId, ...this.alerts.keys()]);
  }
  zoomBy(factor: number) {
    const offset = this.desiredPosition.clone().sub(this.desiredTarget).multiplyScalar(factor);
    offset.setLength(THREE.MathUtils.clamp(offset.length(), 7, 38));
    this.desiredPosition.copy(this.desiredTarget).add(offset);
    this.transitionActive = true;
  }
  resetCamera() { this.setFocus('overview'); }
  resize() {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.interaction?.resize(width, height);
    this.postProcessing?.resize(width, height);
  }
  setVisible(visible: boolean) { this.visible = visible; if (visible) this.clock.start(); else this.clock.stop(); }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.interaction?.dispose();
    this.controls.dispose();
    this.postProcessing?.dispose();
    this.tracker.disposeObject(this.scene);
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
```

- [ ] **Step 4: Type-check and commit the manager**

Run:

```bash
npm run type-check
```

Expected: PASS.

```bash
git add src/three/core/TwinSceneManager.ts
git commit -m "feat: assemble layered twin scene manager"
```

## Task 9: Integrate the Manager with Vue

**Files:**

- Modify: `src/components/three/EnergyTwinScene.vue`
- Modify: `src/views/DashboardView.vue`
- Delete: `src/three/createEnergyScene.ts`

- [ ] **Step 1: Replace direct scene creation with async manager creation**

In `src/components/three/EnergyTwinScene.vue`, replace the current script with:

```ts
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useDashboardStore } from '@/store/dashboard';
import type { TwinSceneApi } from '@/three/types';

const store = useDashboardStore();
const sceneRoot = ref<HTMLElement | null>(null);
const loadingProgress = ref(0);
const sceneReady = ref(false);
const sceneError = ref('');
const hoverTip = ref<{ id: string; label: string; x: number; y: number } | null>(null);
const sceneAlerts = computed(() => store.activeAlerts.slice(0, 2));
let sceneApi: TwinSceneApi | null = null;
let observer: ResizeObserver | null = null;

onMounted(async () => {
  if (!sceneRoot.value) return;
  try {
    const { TwinSceneManager } = await import('@/three/core/TwinSceneManager');
    sceneApi = await TwinSceneManager.create(sceneRoot.value, {
      onProgress: (value) => { loadingProgress.value = Math.round(value * 100); },
      onReady: () => { sceneReady.value = true; },
      onError: (message) => { sceneError.value = message; },
      onHover: (payload) => { hoverTip.value = payload; },
      onSelect: (id) => store.selectNode(id, { openDetail: true }),
    });
    sceneApi.updateScenario(store.scenario);
    sceneApi.updateSnapshot(store.liveSnapshot);
    sceneApi.setFocus(store.focus);
    sceneApi.updateAlerts(store.activeAlerts);
    sceneApi.updateSelected(store.selectedNodeId);
    observer = new ResizeObserver(() => sceneApi?.resize());
    observer.observe(sceneRoot.value);
  } catch (error) {
    sceneError.value = error instanceof Error ? error.message : '数字孪生场景初始化失败';
  }
});

watch(() => store.focus, (value) => sceneApi?.setFocus(value));
watch(() => store.scenario, (value) => sceneApi?.updateScenario(value));
watch(() => store.liveSnapshot, (value) => sceneApi?.updateSnapshot(value), { deep: true });
watch(() => store.activeAlerts, (value) => sceneApi?.updateAlerts(value), { deep: true });
watch(() => store.selectedNodeId, (value) => sceneApi?.updateSelected(value));

onBeforeUnmount(() => { observer?.disconnect(); sceneApi?.dispose(); sceneApi = null; });
```

- [ ] **Step 2: Add explicit loading and degraded states**

Add these overlays to the component template above the normal HUD:

```vue
<div v-if="!sceneReady && !sceneError" class="twin-loading" role="status">
  <span>构建数字孪生</span><strong>{{ loadingProgress }}%</strong>
  <div><i :style="{ width: `${loadingProgress}%` }" /></div>
</div>
<div v-if="sceneError" class="twin-error" role="status">
  <strong>场景已降级</strong><span>{{ sceneError }}</span>
</div>
```

Keep existing focus, zoom, alert, KPI, and tooltip controls, but restyle them with 4px radii and the new tokens. Replace `+`, `-`, and text reset controls with Lucide `ZoomIn`, `ZoomOut`, and `RotateCcw` inside `IconButton`.

- [ ] **Step 3: Lazy-load the whole scene component from the dashboard**

In `src/views/DashboardView.vue`:

```ts
import { defineAsyncComponent } from 'vue';
const EnergyTwinScene = defineAsyncComponent(() => import('@/components/three/EnergyTwinScene.vue'));
```

Remove the static import.

- [ ] **Step 4: Remove the old scene implementation**

Delete `src/three/createEnergyScene.ts`, then run:

```bash
rg "createEnergyScene" src
```

Expected: no matches.

- [ ] **Step 5: Run complete verification**

Run:

```bash
npm test
npm run type-check
npm run build
```

Expected: all tests and build pass; output contains separate UI, chart, and Three.js chunks.

- [ ] **Step 6: Commit Vue integration**

```bash
git add src/components/three/EnergyTwinScene.vue src/views/DashboardView.vue src/three
git commit -m "feat: integrate cinematic campus digital twin"
```

## Task 10: Manually Verify the 3D Milestone

**Files:**

- No source changes expected unless a verified defect is found.

- [ ] **Step 1: Start the dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL.

- [ ] **Step 2: Verify model and effect coverage**

Confirm in the browser:

- Three distinct building instances render from `building.glb`.
- Solar array, chiller, and battery rack GLBs render at expected positions.
- Energy paths respond visibly to timeline changes.
- Only energy paths, selected devices, scans, and alerts Bloom.
- Scenario buttons change atmosphere and flow emphasis.
- Spatial labels follow objects and do not block pointer input.
- Camera presets, orbit, zoom, reset, click selection, and inspector work.

- [ ] **Step 3: Verify adaptive quality**

At 1920px width, confirm high quality on capable hardware. At 1366px, confirm medium DPR and effects. At 390px or with reduced motion, confirm low quality disables post-processing but retains models and flows.

- [ ] **Step 4: Verify cleanup under repeated mounting**

Navigate away/reload the page five times and inspect browser performance tools. Confirm WebGL contexts do not accumulate and only one animation loop remains.

- [ ] **Step 5: Stop the server and confirm clean status**

Send `Ctrl-C`, then run:

```bash
git status --short
```

Expected: empty output.
