export const ONE_SCREEN_MIN_WIDTH = 1800;
export const ONE_SCREEN_MIN_HEIGHT = 1000;

export const isOneScreenViewport = (width: number, height: number) =>
  width >= ONE_SCREEN_MIN_WIDTH && height >= ONE_SCREEN_MIN_HEIGHT;
