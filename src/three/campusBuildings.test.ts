import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createCampusBuilding } from './campusBuildings';

const teachingBuilding = () => createCampusBuilding({
  id: 'building-a',
  label: '教学楼 A',
  kind: 'teaching',
  width: 4.6,
  height: 6,
  depth: 4.2,
  position: [-6.2, 0, -0.8],
});

describe('campus building factory', () => {
  it('preserves interaction metadata, footprint, and the PV roof elevation', () => {
    const building = teachingBuilding();
    const bounds = new THREE.Box3().setFromObject(building);

    expect(building.userData).toMatchObject({ id: 'building-a', label: '教学楼 A', interactive: true });
    expect(building.position.toArray()).toEqual([-6.2, 0, -0.8]);
    expect(bounds.min.y).toBeCloseTo(0);
    expect(bounds.max.y).toBeCloseTo(6.2, 1);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(4.6, 1);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(4.2, 1);
  });

  it('uses visible floor bands and batches dark and sparse lit panes across facades', () => {
    const building = teachingBuilding();
    const bands = building.children.filter((child) => child.name.startsWith('floor-band'));
    const panes: THREE.InstancedMesh[] = [];
    building.traverse((child) => {
      if (child instanceof THREE.InstancedMesh && child.name.startsWith('window-panes-')) panes.push(child);
    });

    expect(bands.length).toBeGreaterThanOrEqual(3);
    expect(panes.map((mesh) => mesh.name).sort()).toEqual(['window-panes-dark', 'window-panes-lit']);
    expect(panes.reduce((count, mesh) => count + mesh.count, 0)).toBeGreaterThanOrEqual(24);
    expect(panes.find((mesh) => mesh.name === 'window-panes-lit')!.count).toBeLessThan(
      panes.find((mesh) => mesh.name === 'window-panes-dark')!.count / 4,
    );

    for (const paneSet of panes) {
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const faceDirections: number[] = [];
      for (let index = 0; index < paneSet.count; index += 1) {
        paneSet.getMatrixAt(index, matrix);
        matrix.decompose(position, rotation, scale);
        faceDirections.push(Math.abs(new THREE.Vector3(0, 0, 1).applyQuaternion(rotation).z));
      }
      expect(faceDirections.some((direction) => direction > 0.9)).toBe(true);
      expect(faceDirections.some((direction) => direction < 0.1)).toBe(true);
    }
  });

  it('frames each window with batched surrounds and mullions', () => {
    const building = teachingBuilding();
    const frame = building.getObjectByName('window-frames');
    const mullions = building.getObjectByName('window-mullions');
    const panes = ['window-panes-dark', 'window-panes-lit'].map((name) =>
      building.getObjectByName(name) as THREE.InstancedMesh,
    );
    const paneCount = panes.reduce((count, mesh) => count + (mesh?.count ?? 0), 0);

    expect(frame).toBeInstanceOf(THREE.InstancedMesh);
    expect(mullions).toBeInstanceOf(THREE.InstancedMesh);
    expect((frame as THREE.InstancedMesh).count).toBe(paneCount);
    expect((mullions as THREE.InstancedMesh).count).toBe(paneCount);
  });

  it('gives the library a vertical glass atrium', () => {
    const building = createCampusBuilding({
      id: 'building-b', label: '图书馆', kind: 'library', width: 4.8, height: 7.4,
      depth: 4.6, position: [0.2, 0, 1.1],
    });

    expect(building.getObjectByName('atrium')).toBeInstanceOf(THREE.Group);
    expect(building.getObjectByName('atrium-glass')).toBeInstanceOf(THREE.Mesh);
  });

  it('gives the laboratory separate rooftop equipment', () => {
    const building = createCampusBuilding({
      id: 'building-c', label: '实验楼', kind: 'laboratory', width: 3.8, height: 4.8,
      depth: 3.8, position: [6.2, 0, -1.6],
    });
    const equipment = building.getObjectByName('roof-equipment');

    expect(equipment).toBeInstanceOf(THREE.Group);
    expect(equipment?.children.length).toBeGreaterThanOrEqual(2);
  });
});
