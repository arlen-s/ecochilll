import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createThermalTank } from './thermalTankModel';

describe('thermal storage tank model', () => {
  it('preserves the animated stratification contract', () => {
    const tank = createThermalTank();
    expect(tank.group.userData).toMatchObject({ id: 'storage', label: '分层蓄能水罐', interactive: true });
    expect(tank.group.position.toArray()).toEqual([-10.2, 0, 6.2]);
    expect(tank.internalBottom).toBe(0.38);
    expect(tank.internalHeight).toBe(3.72);
    expect(tank.storedLayer).toBeInstanceOf(THREE.Mesh);
    expect(tank.returnLayer).toBeInstanceOf(THREE.Mesh);
    expect(tank.interfaceSurface).toBeInstanceOf(THREE.Mesh);
    expect(tank.interfaceRim).toBeInstanceOf(THREE.Mesh);
    expect(tank.pulseRing).toBeInstanceOf(THREE.Mesh);
    for (const surface of [tank.shellMaterial, tank.capMaterial, tank.rimMaterial, tank.pipeMaterial]) {
      expect(surface).toBeInstanceOf(THREE.MeshStandardMaterial);
    }
  });

  it('adds visible service hardware without covering the layered liquid', () => {
    const tank = createThermalTank();
    const shell = tank.group.getObjectByName('tank-shell') as THREE.Mesh;
    const ladder = tank.group.getObjectByName('inspection-ladder') as THREE.Group;
    const supports = tank.group.children.filter((child) => child.name === 'tank-support');
    const valves = tank.group.children.filter((child) => child.name === 'pipe-valve');
    expect(shell).toBeInstanceOf(THREE.Mesh);
    expect(shell.material).toMatchObject({ transparent: true, depthWrite: false });
    expect(ladder).toBeInstanceOf(THREE.Group);
    expect(ladder.position.x).toBeLessThan(-1.4);
    expect(supports.length).toBeGreaterThanOrEqual(3);
    expect(valves).toHaveLength(2);
    expect(tank.group.getObjectByName('upper-pipe')).toBeInstanceOf(THREE.Mesh);
    expect(tank.group.getObjectByName('lower-pipe')).toBeInstanceOf(THREE.Mesh);
  });
});
