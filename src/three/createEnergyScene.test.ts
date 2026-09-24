import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createEnergyFlowPaths, createFlowVisual } from './flowVisuals';
import { getResponsivePreset } from './createEnergyScene';

describe('campus energy flow visuals', () => {
  it('uses narrow conduits and directional pulses instead of broad glow tubes', () => {
    const flow = createFlowVisual(
      'pv-plant',
      [new THREE.Vector3(-2, 6, 0), new THREE.Vector3(0, 4, 2), new THREE.Vector3(4, 2, 5)],
      '#15f5ba', 0.16, 'electric',
    );
    expect(flow.id).toBe('pv-plant');
    expect(flow.pipe).toBeInstanceOf(THREE.Mesh);
    expect(flow.pipe.geometry).toBeInstanceOf(THREE.TubeGeometry);
    expect(flow.pipe.geometry.parameters.radius).toBeLessThan(0.09);
    expect(flow.glow.geometry.parameters.radius).toBeLessThan(0.08);
    expect(flow.particles.length).toBeGreaterThanOrEqual(6);
    expect(flow.particles.every((particle) => particle.mesh.geometry instanceof THREE.ConeGeometry)).toBe(true);
  });

  it('retains four distinct electrical and thermal routes', () => {
    const flows = createEnergyFlowPaths();
    expect(flows.map((flow) => flow.id)).toEqual([
      'pv-plant', 'grid-plant', 'plant-storage', 'storage-buildings',
    ]);
    expect(flows.map((flow) => flow.kind)).toEqual([
      'electric', 'electric', 'thermal', 'thermal',
    ]);
    expect(flows.every((flow) => flow.curve.points.length >= 3)).toBe(true);
  });
});

describe('responsive overview framing', () => {
  it('backs the camera away on portrait screens so the whole campus remains visible', () => {
    const preset = { position: new THREE.Vector3(18, 12, 22), target: new THREE.Vector3(0, 1, 0) };
    const originalDistance = preset.position.distanceTo(preset.target);
    const desktop = getResponsivePreset(preset, 1.6, 'overview');
    const portrait = getResponsivePreset(preset, 0.6, 'overview');
    expect(desktop.position.distanceTo(desktop.target)).toBeCloseTo(originalDistance);
    expect(portrait.position.distanceTo(portrait.target)).toBeGreaterThan(originalDistance * 2);
  });
});
