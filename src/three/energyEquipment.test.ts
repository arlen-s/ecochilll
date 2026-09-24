import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAcStation, createGridGateway, createPvArray } from './energyEquipment';

const descendants = (group: THREE.Object3D) => {
  const names: string[] = [];
  group.traverse((child) => names.push(child.name));
  return names;
};

describe('campus energy equipment', () => {
  it('mounts 24 detailed solar panels within the two building roofs', () => {
    const array = createPvArray();
    const panels = array.getObjectByName('pv-panel-surface') as THREE.InstancedMesh;
    const cells = array.getObjectByName('pv-cells') as THREE.InstancedMesh;
    const supports = array.getObjectByName('pv-supports') as THREE.InstancedMesh;
    const hitTargets = array.children.filter((child) => child.name === 'pv-hit-target');
    const matrix = new THREE.Matrix4();
    const center = new THREE.Vector3();
    const roofA = { x: [-8.5, -3.9], z: [-2.9, 1.3], y: 6.16 };
    const roofB = { x: [-2.2, 2.6], z: [-1.2, 3.4], y: 7.56 };

    expect(array.userData).toMatchObject({ id: 'pv', label: '屋顶光伏阵列', interactive: true });
    expect(panels).toBeInstanceOf(THREE.InstancedMesh);
    expect(panels.count).toBe(24);
    expect(cells).toBeInstanceOf(THREE.InstancedMesh);
    expect(cells.count).toBeGreaterThanOrEqual(96);
    expect(supports).toBeInstanceOf(THREE.InstancedMesh);
    expect(supports.count).toBeGreaterThanOrEqual(48);
    expect(hitTargets).toHaveLength(2);
    expect(new THREE.Box3().setFromObject(hitTargets[0]).min.y).toBeGreaterThan(roofA.y);
    expect(new THREE.Box3().setFromObject(hitTargets[1]).min.y).toBeGreaterThan(roofB.y);
    for (let index = 0; index < panels.count; index += 1) {
      panels.getMatrixAt(index, matrix);
      center.setFromMatrixPosition(matrix);
      const roof = index < 12 ? roofA : roofB;
      expect(center.x).toBeGreaterThan(roof.x[0] + 0.25);
      expect(center.x).toBeLessThan(roof.x[1] - 0.25);
      expect(center.z).toBeGreaterThan(roof.z[0] + 0.35);
      expect(center.z).toBeLessThan(roof.z[1] - 0.35);
      expect(center.y).toBeGreaterThan(roof.y + 0.12);
      expect(center.y).toBeLessThan(roof.y + 0.65);
    }
  });

  it('makes the thermal plant readable as a machine room', () => {
    const station = createAcStation();
    const names = descendants(station);
    expect(station.position.toArray()).toEqual([5.4, 0, 5.8]);
    expect(station.userData).toMatchObject({ id: 'ac', label: '冷热源机房', interactive: true });
    expect(names).toContain('ac-housing');
    expect(names.filter((name) => name === 'fan-grille')).toHaveLength(3);
    expect(names).toContain('ac-louvers');
    expect(names).toContain('ac-supply-pipe');
    expect(names).toContain('ac-return-pipe');
  });

  it('makes the grid interface a transformer and cable structure', () => {
    const gateway = createGridGateway();
    const names = descendants(gateway);
    expect(gateway.position.toArray()).toEqual([12.8, 0, 4.8]);
    expect(gateway.userData).toMatchObject({ id: 'grid', label: '园区电网接口', interactive: true });
    expect(names).toContain('transformer-cabinet');
    expect(names.filter((name) => name === 'grid-insulator')).toHaveLength(3);
    expect(names).toContain('grid-cable');
  });
});
