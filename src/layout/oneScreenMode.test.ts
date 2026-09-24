import { describe, expect, it } from 'vitest';
import { isOneScreenViewport } from './oneScreenMode';

describe('one-screen viewport', () => {
  it.each([
    [1920, 1080, true],
    [2560, 1440, true],
    [1799, 1080, false],
    [1920, 999, false],
    [1440, 900, false],
  ])('%i × %i activates: %s', (width, height, expected) => {
    expect(isOneScreenViewport(width, height)).toBe(expected);
  });
});
