import type { FaceAnnotationRect } from './mediaFaceAnnotationModel';

export type ImageDisplayMetrics = {
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
  naturalWidth: number;
  naturalHeight: number;
};

export type ScreenRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function computeImageDisplayMetrics(
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): ImageDisplayMetrics {
  if (!containerWidth || !containerHeight || !naturalWidth || !naturalHeight) {
    return {
      offsetX: 0,
      offsetY: 0,
      displayWidth: containerWidth,
      displayHeight: containerHeight,
      naturalWidth,
      naturalHeight,
    };
  }

  const scale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
  const displayWidth = naturalWidth * scale;
  const displayHeight = naturalHeight * scale;

  return {
    offsetX: (containerWidth - displayWidth) / 2,
    offsetY: (containerHeight - displayHeight) / 2,
    displayWidth,
    displayHeight,
    naturalWidth,
    naturalHeight,
  };
}

export function normalizedRectToScreen(
  rect: FaceAnnotationRect,
  metrics: ImageDisplayMetrics,
): ScreenRect {
  return {
    x: metrics.offsetX + rect.x * metrics.displayWidth,
    y: metrics.offsetY + rect.y * metrics.displayHeight,
    width: rect.width * metrics.displayWidth,
    height: rect.height * metrics.displayHeight,
  };
}

export function screenRectToNormalized(
  rect: ScreenRect,
  metrics: ImageDisplayMetrics,
): { x: number; y: number; width: number; height: number } {
  const relX = (rect.x - metrics.offsetX) / metrics.displayWidth;
  const relY = (rect.y - metrics.offsetY) / metrics.displayHeight;
  const relW = rect.width / metrics.displayWidth;
  const relH = rect.height / metrics.displayHeight;

  return {
    x: clamp01(relX),
    y: clamp01(relY),
    width: clamp01(Math.min(relW, 1 - relX)),
    height: clamp01(Math.min(relH, 1 - relY)),
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function pointInImageMetrics(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  metrics: ImageDisplayMetrics,
): { x: number; y: number } | null {
  const x = clientX - containerRect.left - metrics.offsetX;
  const y = clientY - containerRect.top - metrics.offsetY;
  if (x < 0 || y < 0 || x > metrics.displayWidth || y > metrics.displayHeight) {
    return null;
  }
  return { x, y };
}
